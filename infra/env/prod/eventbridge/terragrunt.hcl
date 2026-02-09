include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

locals {
  common_vars = read_terragrunt_config(find_in_parent_folders("common.hcl"))
}

terraform {
  source = "../../../modules/eventbridge"
}

dependency "lambda" {
  config_path = "../lambda"
}

inputs = {
  project_name              = local.common_vars.locals.project_name
  tick_handler_function_name = dependency.lambda.outputs.tick_handler_function_name
  tick_handler_arn           = dependency.lambda.outputs.tick_handler_arn
  tags                      = local.common_vars.locals.common_tags
}
