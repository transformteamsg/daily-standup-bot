variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "create_db_subnet_group" {
  description = "Whether to create a DB subnet group (set to false for LocalStack)"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
