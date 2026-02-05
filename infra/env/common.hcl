locals {
  project_name = "tfx-slack-bot"

  common_tags = {
    Project   = "tfx-slack-bot"
    ManagedBy = "terragrunt"
  }
}
