# Cognito User Pool for SMS OTP Authentication
resource "aws_cognito_user_pool" "main" {
  name = "${var.domain_name}-user-pool"

  # Phone number as username
  username_attributes = ["phone_number"]

  # Auto-verify phone numbers
  auto_verified_attributes = ["phone_number"]

  # Phone number configuration
  sms_configuration {
    external_id    = "${var.domain_name}-external"
    sns_caller_arn = aws_iam_role.cognito_sns.arn
    sns_region     = var.aws_region
  }

  # MFA configuration - SMS required
  mfa_configuration = "OPTIONAL"

  # User attributes schema
  schema {
    name                = "phone_number"
    attribute_data_type = "String"
    required            = true
    mutable             = false
  }

  # Password policy (not used for SMS OTP, but required)
  password_policy {
    minimum_length    = 8
    require_lowercase = false
    require_numbers   = false
    require_symbols   = false
    require_uppercase = false
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_phone_number"
      priority = 1
    }
  }

  # Lambda triggers for custom auth flow
  lambda_config {
    define_auth_challenge          = aws_lambda_function.functions["define_auth_challenge"].arn
    create_auth_challenge          = aws_lambda_function.functions["create_auth_challenge"].arn
    verify_auth_challenge_response = aws_lambda_function.functions["verify_auth_challenge_response"].arn
  }

  tags = {
    Name        = "${var.domain_name}-user-pool"
    Environment = var.environment
  }
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.domain_name}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # Enable custom auth flow (for SMS OTP)
  explicit_auth_flows = [
    "ALLOW_CUSTOM_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # No client secret (for frontend/mobile apps)
  generate_secret = false

  # Token validity
  access_token_validity  = 60  # 1 hour
  id_token_validity      = 60  # 1 hour
  refresh_token_validity = 43200 # 30 days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "minutes"
  }

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"

  # Allowed OAuth flows (not used for custom auth, but good to have)
  allowed_oauth_flows_user_pool_client = false

  # Read/write attributes
  read_attributes  = ["phone_number", "phone_number_verified"]
  write_attributes = ["phone_number"]
}

# IAM Role for Cognito to send SMS via SNS
resource "aws_iam_role" "cognito_sns" {
  name = "${replace(var.domain_name, ".", "-")}-cognito-sns-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cognito-idp.amazonaws.com"
        }
        Action = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "sts:ExternalId" = "${var.domain_name}-external"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${var.domain_name}-cognito-sns-role"
    Environment = var.environment
  }
}

# IAM Policy for Cognito to publish SMS via SNS
resource "aws_iam_role_policy" "cognito_sns" {
  name = "${replace(var.domain_name, ".", "-")}-cognito-sns-policy"
  role = aws_iam_role.cognito_sns.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda permissions for Cognito to invoke triggers
resource "aws_lambda_permission" "cognito_define_auth_challenge" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["define_auth_challenge"].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "cognito_create_auth_challenge" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["create_auth_challenge"].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "cognito_verify_auth_challenge" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["verify_auth_challenge_response"].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}
