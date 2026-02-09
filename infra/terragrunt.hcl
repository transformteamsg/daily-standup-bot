locals {
  common_vars = read_terragrunt_config(find_in_parent_folders("common.hcl"))
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))

  project_name  = local.common_vars.locals.project_name
  aws_region    = local.env_vars.locals.aws_region
  is_localstack = get_env("LOCALSTACK", "") != ""

  provider_localstack = <<EOF
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                      = "${local.aws_region}"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    apigateway = "http://localhost:4566"
    cloudwatch = "http://localhost:4566"
    dynamodb   = "http://localhost:4566"
    iam        = "http://localhost:4566"
    lambda     = "http://localhost:4566"
    s3         = "http://localhost:4566"
    sts        = "http://localhost:4566"
  }
}
EOF

  provider_aws = <<EOF
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${local.aws_region}"
}
EOF
}

remote_state {
  backend = "s3"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }

  config = {
    bucket         = "${local.project_name}-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.aws_region
    dynamodb_table = "${local.project_name}-terraform-locks"

    encrypt        = local.is_localstack ? false : true
    force_path_style = local.is_localstack ? true : false

    endpoint          = local.is_localstack ? "http://localhost:4566" : ""
    dynamodb_endpoint = local.is_localstack ? "http://localhost:4566" : ""

    skip_credentials_validation    = local.is_localstack
    skip_metadata_api_check        = local.is_localstack
    skip_bucket_versioning         = local.is_localstack
    skip_bucket_ssencryption       = local.is_localstack
    skip_bucket_root_access        = local.is_localstack
    skip_bucket_enforced_tls       = local.is_localstack
    skip_bucket_public_access_blocking = local.is_localstack
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = local.is_localstack ? local.provider_localstack : local.provider_aws
}
