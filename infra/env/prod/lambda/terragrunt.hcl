include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

locals {
  common_vars = read_terragrunt_config(find_in_parent_folders("common.hcl"))
}

terraform {
  source = "../../../modules/lambda"
}

dependency "vpc" {
  config_path = "../vpc"
}

dependency "security_groups" {
  config_path = "../security-groups"
}

dependency "rds" {
  config_path = "../rds"
  mock_outputs = {
    database_url = "postgresql://standup:standup@localhost:5432/standup"
    secret_arn   = ""
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "apply", "destroy"]
}

inputs = {
  project_name         = local.common_vars.locals.project_name
  private_subnet_ids   = dependency.vpc.outputs.private_subnet_ids
  lambda_sg_id         = dependency.security_groups.outputs.lambda_sg_id
  secret_arn           = dependency.rds.outputs.secret_arn
  database_url         = dependency.rds.outputs.database_url
  dist_dir             = "${get_repo_root()}/dist"
  slack_bot_token      = get_env("TF_VAR_slack_bot_token")
  slack_signing_secret = get_env("TF_VAR_slack_signing_secret")
  superadmin_user_id   = get_env("TF_VAR_superadmin_user_id")
  tags                 = local.common_vars.locals.common_tags
  enable_function_url  = get_env("LOCALSTACK", "") != ""
}
