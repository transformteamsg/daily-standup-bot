#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TfxSlackBotStack } from "../lib/stack";

const app = new cdk.App();

new TfxSlackBotStack(app, "TfxSlackBotStack", {
  env: {
    region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1",
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
