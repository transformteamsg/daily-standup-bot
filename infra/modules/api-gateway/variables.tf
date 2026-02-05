variable "slack_handler_function_name" {
  description = "Name of the Slack handler Lambda function"
  type        = string
}

variable "slack_handler_invoke_arn" {
  description = "Invoke ARN of the Slack handler Lambda function"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
