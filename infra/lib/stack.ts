import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import type { Construct } from "constructs";
import * as path from "path";

export class TfxSlackBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- VPC ---
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // --- Security Groups ---
    const lambdaSg = new ec2.SecurityGroup(this, "LambdaSg", {
      vpc,
      description: "Security group for Lambda functions",
      allowAllOutbound: true,
    });

    const rdsSg = new ec2.SecurityGroup(this, "RdsSg", {
      vpc,
      description: "Security group for RDS PostgreSQL",
      allowAllOutbound: false,
    });

    rdsSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), "Allow Lambda to connect to RDS");

    // --- RDS PostgreSQL ---
    const dbInstance = new rds.DatabaseInstance(this, "Database", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [rdsSg],
      databaseName: "standup",
      credentials: rds.Credentials.fromGeneratedSecret("standup", {
        secretName: "tfx-slack-bot/rds-credentials",
      }),
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      multiAz: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      deletionProtection: false,
    });

    // --- Lambda Environment Variables ---
    const slackBotToken = new cdk.CfnParameter(this, "SlackBotToken", {
      type: "String",
      noEcho: true,
      description: "Slack Bot Token (xoxb-...)",
    });

    const slackSigningSecret = new cdk.CfnParameter(this, "SlackSigningSecret", {
      type: "String",
      noEcho: true,
      description: "Slack Signing Secret",
    });

    const superadminUserId = new cdk.CfnParameter(this, "SuperadminUserId", {
      type: "String",
      description: "Slack User ID of the superadmin",
    });

    const lambdaEnvironment: Record<string, string> = {
      SLACK_BOT_TOKEN: slackBotToken.valueAsString,
      SLACK_SIGNING_SECRET: slackSigningSecret.valueAsString,
      SUPERADMIN_USER_ID: superadminUserId.valueAsString,
      DATABASE_URL: cdk.Fn.join("", [
        "postgresql://",
        dbInstance.secret!.secretValueFromJson("username").unsafeUnwrap(),
        ":",
        dbInstance.secret!.secretValueFromJson("password").unsafeUnwrap(),
        "@",
        dbInstance.dbInstanceEndpointAddress,
        ":",
        dbInstance.dbInstanceEndpointPort,
        "/standup",
      ]),
      LOG_LEVEL: "info",
    };

    // --- Lambda: Slack Handler ---
    const slackHandler = new lambda.Function(this, "SlackHandler", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "slack.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../dist/handlers"), {
        bundling: undefined,
      }),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: lambdaEnvironment,
    });

    // --- Lambda: Tick Handler ---
    const tickHandler = new lambda.Function(this, "TickHandler", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "tick.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../dist/handlers"), {
        bundling: undefined,
      }),
      memorySize: 256,
      timeout: cdk.Duration.seconds(60),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: lambdaEnvironment,
    });

    // Grant RDS secret access to Lambda functions
    dbInstance.secret!.grantRead(slackHandler);
    dbInstance.secret!.grantRead(tickHandler);

    // --- API Gateway (HTTP API) ---
    const httpApi = new apigatewayv2.HttpApi(this, "HttpApi", {
      apiName: "TfxSlackBotApi",
      description: "HTTP API for Slack events",
    });

    httpApi.addRoutes({
      path: "/slack/events",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        "SlackIntegration",
        slackHandler
      ),
    });

    // --- EventBridge Rule (every minute) ---
    new events.Rule(this, "TickRule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new targets.LambdaFunction(tickHandler)],
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: httpApi.apiEndpoint,
      description: "HTTP API endpoint for Slack events",
    });

    new cdk.CfnOutput(this, "SlackRequestUrl", {
      value: `${httpApi.apiEndpoint}/slack/events`,
      description: "URL to configure as Slack Request URL",
    });
  }
}
