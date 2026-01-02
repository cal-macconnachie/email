# SSM Parameters for VAPID keys (Web Push Notifications)
#
# These parameters are AUTOMATICALLY created by the GitHub Actions workflow
# on first deployment. Terraform only references them as data sources.
#
# The workflow (.github/workflows/deploy.yml) handles:
# 1. Checking if VAPID keys exist in SSM
# 2. If not, generating new keys and storing them
# 3. Loading the public key for frontend build
#
# No manual setup required - just push a tag and deploy!

data "aws_ssm_parameter" "vapid_public_key" {
  name = "/${var.domain_name}/vapid/public-key"
}

data "aws_ssm_parameter" "vapid_private_key" {
  name            = "/${var.domain_name}/vapid/private-key"
  with_decryption = false # We don't need to decrypt it, just reference it
}

data "aws_ssm_parameter" "vapid_subject" {
  name = "/${var.domain_name}/vapid/subject"
}

# Outputs for reference (optional)
output "vapid_public_key_parameter_name" {
  description = "SSM parameter name for VAPID public key"
  value       = data.aws_ssm_parameter.vapid_public_key.name
}

output "vapid_private_key_parameter_name" {
  description = "SSM parameter name for VAPID private key"
  value       = data.aws_ssm_parameter.vapid_private_key.name
  sensitive   = true
}
