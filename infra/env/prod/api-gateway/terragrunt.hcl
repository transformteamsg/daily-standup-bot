include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

locals {
  common_vars = read_terragrunt_config(find_in_parent_folders("common.hcl"))
}

terraform {
  source = "../../../modules/api-gateway"
}

dependency "lambda" {
  config_path = "../lambda"
}

inputs = {
  slack_handler_function_name = dependency.lambda.outputs.slack_handler_function_name
  slack_handler_invoke_arn    = dependency.lambda.outputs.slack_handler_invoke_arn
  tags                       = local.common_vars.locals.common_tags
}
