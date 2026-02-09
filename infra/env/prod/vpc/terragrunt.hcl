include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

locals {
  common_vars = read_terragrunt_config(find_in_parent_folders("common.hcl"))
}

terraform {
  source = "../../../modules/vpc"
}

inputs = {
  project_name = local.common_vars.locals.project_name
  tags         = local.common_vars.locals.common_tags
}
