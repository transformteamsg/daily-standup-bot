variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets for Lambda VPC config"
  type        = list(string)
}

variable "lambda_sg_id" {
  description = "ID of the Lambda security group"
  type        = string
}

variable "secret_arn" {
  description = "ARN of the Secrets Manager secret for RDS credentials"
  type        = string
}

variable "database_url" {
  description = "PostgreSQL connection URL"
  type        = string
  sensitive   = true
}

variable "slack_bot_token" {
  description = "Slack Bot Token (xoxb-...)"
  type        = string
  sensitive   = true
}

variable "slack_signing_secret" {
  description = "Slack Signing Secret"
  type        = string
  sensitive   = true
}

variable "superadmin_user_id" {
  description = "Slack User ID of the superadmin"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
