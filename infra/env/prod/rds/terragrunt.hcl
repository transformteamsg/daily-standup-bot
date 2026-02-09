include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

locals {
  common_vars = read_terragrunt_config(find_in_parent_folders("common.hcl"))
}

terraform {
  source = "../../../modules/rds"
}

dependency "vpc" {
  config_path = "../vpc"
}

dependency "security_groups" {
  config_path = "../security-groups"
}

inputs = {
  project_name         = local.common_vars.locals.project_name
  db_subnet_group_name = dependency.vpc.outputs.db_subnet_group_name
  rds_sg_id            = dependency.security_groups.outputs.rds_sg_id
  tags                 = local.common_vars.locals.common_tags
}
