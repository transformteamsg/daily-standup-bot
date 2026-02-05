# --- IAM Role ---

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_secrets" {
  name = "${var.project_name}-lambda-secrets"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.secret_arn
      }
    ]
  })
}

# --- Lambda Package ---

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../../../dist/handlers"
  output_path = "${path.module}/../../../dist/lambda.zip"
}

# --- Lambda Functions ---

resource "aws_lambda_function" "slack_handler" {
  function_name = "${var.project_name}-slack-handler"
  role          = aws_iam_role.lambda.arn
  handler       = "slack.handler"
  runtime       = "nodejs20.x"
  memory_size   = 256
  timeout       = 30

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }

  environment {
    variables = {
      SLACK_BOT_TOKEN      = var.slack_bot_token
      SLACK_SIGNING_SECRET = var.slack_signing_secret
      SUPERADMIN_USER_ID   = var.superadmin_user_id
      DATABASE_URL         = var.database_url
      LOG_LEVEL            = "info"
    }
  }

  tags = var.tags
}

resource "aws_lambda_function" "tick_handler" {
  function_name = "${var.project_name}-tick-handler"
  role          = aws_iam_role.lambda.arn
  handler       = "tick.handler"
  runtime       = "nodejs20.x"
  memory_size   = 256
  timeout       = 60

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }

  environment {
    variables = {
      SLACK_BOT_TOKEN      = var.slack_bot_token
      SLACK_SIGNING_SECRET = var.slack_signing_secret
      SUPERADMIN_USER_ID   = var.superadmin_user_id
      DATABASE_URL         = var.database_url
      LOG_LEVEL            = "info"
    }
  }

  tags = var.tags
}
