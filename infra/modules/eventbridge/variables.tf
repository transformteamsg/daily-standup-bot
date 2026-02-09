variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "tick_handler_function_name" {
  description = "Name of the tick handler Lambda function"
  type        = string
}

variable "tick_handler_arn" {
  description = "ARN of the tick handler Lambda function"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
