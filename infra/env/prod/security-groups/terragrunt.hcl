include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

locals {
  common_vars = read_terragrunt_config(find_in_parent_folders("common.hcl"))
}

terraform {
  source = "../../../modules/security-groups"
}

dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  project_name = local.common_vars.locals.project_name
  vpc_id       = dependency.vpc.outputs.vpc_id
  tags         = local.common_vars.locals.common_tags
}
