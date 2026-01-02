# Lambda Configuration
# Define your Lambda functions here by adding entries to the lambda_functions local variable

locals {
  # Define Lambda functions here - add new functions to this map
  # Note: Run 'yarn build' before deploying to bundle Lambda functions with esbuild
  lambda_functions = {
    receive_ses_email = {
      description = "Process incoming SES emails and store in S3 with structured paths"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 60
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/receive-ses-email"
      environment_vars = {
        S3_BUCKET_NAME              = "${var.domain_name}-ses-emails"
        DYNAMODB_TABLE_NAME         = "${var.domain_name}-emails"
        THREAD_RELATIONS_TABLE_NAME = "${var.domain_name}-thread-relations"
      }
    }
    get_attachment_upload_presign = {
      description = "Generate presigned URL for uploading email attachments"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 30
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/get-attachment-upload-presign"
      environment_vars = {
        S3_BUCKET_NAME              = "${var.domain_name}-ses-emails"
        PHONE_EMAIL_RELATIONS_TABLE = "${var.domain_name}-phone-email-relations"
      }
    }
    send_email = {
      description = "Send email via SES and store in S3/DynamoDB"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 60
      memory_size = 512
      source_dir  = "${path.module}/dist/lambdas/send-email"
      environment_vars = {
        S3_BUCKET_NAME              = "${var.domain_name}-ses-emails"
        DYNAMODB_TABLE_NAME         = "${var.domain_name}-emails"
        THREAD_RELATIONS_TABLE_NAME = "${var.domain_name}-thread-relations"
        PHONE_EMAIL_RELATIONS_TABLE = "${var.domain_name}-phone-email-relations"
      }
    }
    get_full_email = {
      description = "Retrieve full email content from S3"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 30
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/get-full-email"
      environment_vars = {
        S3_BUCKET_NAME              = "${var.domain_name}-ses-emails"
        PHONE_EMAIL_RELATIONS_TABLE = "${var.domain_name}-phone-email-relations"
      }
    }
    list_emails = {
      description = "List and filter emails from DynamoDB"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 30
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/list-emails"
      environment_vars = {
        DYNAMODB_TABLE_NAME         = "${var.domain_name}-emails"
        PHONE_EMAIL_RELATIONS_TABLE = "${var.domain_name}-phone-email-relations"
      }
    }
    update_email = {
      description = "Update email read/archived status"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 30
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/update-email"
      environment_vars = {
        S3_BUCKET_NAME              = "${var.domain_name}-ses-emails"
        DYNAMODB_TABLE_NAME         = "${var.domain_name}-emails"
        PHONE_EMAIL_RELATIONS_TABLE = "${var.domain_name}-phone-email-relations"
      }
    }
    get_thread_emails = {
      description = "Retrieve all emails in a thread for a specific recipient"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 30
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/get-thread-emails"
      environment_vars = {
        S3_BUCKET_NAME              = "${var.domain_name}-ses-emails"
        DYNAMODB_TABLE_NAME         = "${var.domain_name}-emails"
        THREAD_RELATIONS_TABLE_NAME = "${var.domain_name}-thread-relations"
        PHONE_EMAIL_RELATIONS_TABLE = "${var.domain_name}-phone-email-relations"
      }
    }
    # Auth Lambda Functions - Cognito Triggers
    define_auth_challenge = {
      description      = "Cognito trigger: Define custom authentication challenge flow"
      handler          = "index.handler"
      runtime          = "nodejs22.x"
      timeout          = 10
      memory_size      = 128
      source_dir       = "${path.module}/dist/lambdas/auth/define-auth-challenge"
      environment_vars = {}
    }
    create_auth_challenge = {
      description      = "Cognito trigger: Generate OTP and send via SNS"
      handler          = "index.handler"
      runtime          = "nodejs22.x"
      timeout          = 30
      memory_size      = 256
      source_dir       = "${path.module}/dist/lambdas/auth/create-auth-challenge"
      environment_vars = {}
    }
    verify_auth_challenge_response = {
      description      = "Cognito trigger: Verify OTP code"
      handler          = "index.handler"
      runtime          = "nodejs22.x"
      timeout          = 10
      memory_size      = 128
      source_dir       = "${path.module}/dist/lambdas/auth/verify-auth-challenge-response"
      environment_vars = {}
    }
    pre_token_generation = {
      description      = "Cognito trigger: Add custom claims to tokens"
      handler          = "index.handler"
      runtime          = "nodejs22.x"
      timeout          = 10
      memory_size      = 128
      source_dir       = "${path.module}/dist/lambdas/auth/pre-token-generation"
      environment_vars = {}
    }
    # Auth Lambda Functions - API Endpoints
    request_otp = {
      description = "Initiate SMS OTP authentication flow"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 30
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/auth/request-otp"
      environment_vars = {
        # Cognito IDs will be added via aws_lambda_function resource to avoid circular dependency
        PHONE_EMAIL_RELATIONS_TABLE = "${var.domain_name}-phone-email-relations"
      }
    }
    verify_otp = {
      description = "Verify OTP code and set HTTP-only cookies"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 30
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/auth/verify-otp"
      environment_vars = {
        # Cognito IDs will be added via aws_lambda_function resource to avoid circular dependency
      }
    }
    logout = {
      description      = "Clear session cookies to log user out"
      handler          = "index.handler"
      runtime          = "nodejs22.x"
      timeout          = 10
      memory_size      = 128
      source_dir       = "${path.module}/dist/lambdas/auth/logout"
      environment_vars = {}
    }
    refresh_token = {
      description = "Refresh access token using refresh token"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 30
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/auth/refresh-token"
      environment_vars = {
        # Cognito IDs will be added via aws_lambda_function resource to avoid circular dependency
      }
    }
    lambda_authorizer = {
      description      = "Lambda authorizer to validate JWT from cookies"
      handler          = "index.handler"
      runtime          = "nodejs22.x"
      timeout          = 10
      memory_size      = 128
      source_dir       = "${path.module}/dist/lambdas/auth/lambda-authorizer"
      environment_vars = {}
    }
    # Push Notification Lambda Functions
    subscribe_push = {
      description = "Register push notification subscription for authenticated user"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 30
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/push/subscribe-push"
      environment_vars = {
        PUSH_SUBSCRIPTIONS_TABLE    = "${var.domain_name}-push-subscriptions"
        PHONE_EMAIL_RELATIONS_TABLE = "${var.domain_name}-phone-email-relations"
      }
    }
    unsubscribe_push = {
      description = "Remove push notification subscription"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 30
      memory_size = 256
      source_dir  = "${path.module}/dist/lambdas/push/unsubscribe-push"
      environment_vars = {
        PUSH_SUBSCRIPTIONS_TABLE    = "${var.domain_name}-push-subscriptions"
        PHONE_EMAIL_RELATIONS_TABLE = "${var.domain_name}-phone-email-relations"
      }
    }
    process_email_stream = {
      description = "Process DynamoDB Stream events from emails table and send push notifications"
      handler     = "index.handler"
      runtime     = "nodejs22.x"
      timeout     = 60
      memory_size = 512
      source_dir  = "${path.module}/dist/lambdas/push/process-email-stream"
      environment_vars = {
        PUSH_SUBSCRIPTIONS_TABLE    = "${var.domain_name}-push-subscriptions"
        PHONE_EMAIL_RELATIONS_TABLE = "${var.domain_name}-phone-email-relations"
        VAPID_PUBLIC_KEY_PARAM      = "/${var.domain_name}/vapid/public-key"
        VAPID_PRIVATE_KEY_PARAM     = "/${var.domain_name}/vapid/private-key"
        VAPID_SUBJECT_PARAM         = "/${var.domain_name}/vapid/subject"
      }
    }
  }

  # Sanitized domain name for Lambda function names (replace dots with hyphens)
  lambda_prefix = replace(var.domain_name, ".", "-")

  # Common tags for all Lambda resources
  lambda_common_tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = "Email"
  }
}

# IAM Role for Lambda execution
resource "aws_iam_role" "lambda_execution" {
  name = "${local.lambda_prefix}-lambda-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.lambda_common_tags,
    {
      Name = "${local.lambda_prefix}-lambda-execution-role"
    }
  )
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom IAM policy for Lambda functions (add permissions as needed)
resource "aws_iam_role_policy" "lambda_custom_policy" {
  name = "${local.lambda_prefix}-lambda-custom-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${var.domain_name}-ses-emails/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::${var.domain_name}-ses-emails"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.domain_name}-emails",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.domain_name}-emails/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.domain_name}-thread-relations",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.domain_name}-thread-relations/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminInitiateAuth",
          "cognito-idp:AdminRespondToAuthChallenge",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminSetUserPassword"
        ]
        Resource = "arn:aws:cognito-idp:${var.aws_region}:*:userpool/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.domain_name}-phone-email-relations",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.domain_name}-phone-email-relations/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.domain_name}-push-subscriptions",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.domain_name}-push-subscriptions/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]
        Resource = "${aws_dynamodb_table.email_tracking.stream_arn}"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:*:parameter/${var.domain_name}/vapid/*"
        ]
      }
    ]
  })
}

# CloudWatch Log Groups for Lambda functions
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = local.lambda_functions

  name              = "/aws/lambda/${local.lambda_prefix}-${each.key}"
  retention_in_days = 14

  tags = merge(
    local.lambda_common_tags,
    {
      Name     = "${local.lambda_prefix}-${each.key}-logs"
      Function = each.key
    }
  )
}

# Archive Lambda source code
data "archive_file" "lambda_zip" {
  for_each = local.lambda_functions

  type        = "zip"
  source_dir  = each.value.source_dir
  output_path = "${path.module}/.terraform/lambda_builds/${each.key}.zip"
}

# Lambda Functions (excluding auth API functions that need Cognito IDs)
resource "aws_lambda_function" "functions" {
  for_each = {
    for k, v in local.lambda_functions : k => v
    if !contains(["request_otp", "verify_otp", "logout", "refresh_token"], k)
  }

  function_name = "${local.lambda_prefix}-${each.key}"
  description   = each.value.description
  role          = aws_iam_role.lambda_execution.arn
  handler       = each.value.handler
  runtime       = coalesce(each.value.runtime, "nodejs22.x")
  timeout       = coalesce(each.value.timeout, 30)
  memory_size   = coalesce(each.value.memory_size, 256)

  filename         = data.archive_file.lambda_zip[each.key].output_path
  source_code_hash = data.archive_file.lambda_zip[each.key].output_base64sha256

  environment {
    variables = merge(
      {
        ENVIRONMENT = var.environment
        REGION      = var.aws_region
      },
      lookup(each.value, "environment_vars", {})
    )
  }

  # Optional: Enable tracing
  tracing_config {
    mode = "PassThrough"
  }

  tags = merge(
    local.lambda_common_tags,
    {
      Name     = "${local.lambda_prefix}-${each.key}"
      Function = each.key
    }
  )

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution
  ]
}

# Separate Lambda functions for auth API endpoints that need Cognito IDs
# These are created after Cognito to avoid circular dependency
resource "aws_lambda_function" "auth_api_functions" {
  for_each = {
    request_otp   = local.lambda_functions["request_otp"]
    verify_otp    = local.lambda_functions["verify_otp"]
    logout        = local.lambda_functions["logout"]
    refresh_token = local.lambda_functions["refresh_token"]
  }

  function_name = "${local.lambda_prefix}-${each.key}"
  description   = each.value.description
  role          = aws_iam_role.lambda_execution.arn
  handler       = each.value.handler
  runtime       = coalesce(each.value.runtime, "nodejs22.x")
  timeout       = coalesce(each.value.timeout, 30)
  memory_size   = coalesce(each.value.memory_size, 256)

  filename         = data.archive_file.lambda_zip[each.key].output_path
  source_code_hash = data.archive_file.lambda_zip[each.key].output_base64sha256

  environment {
    variables = merge(
      {
        ENVIRONMENT          = var.environment
        REGION               = var.aws_region
        COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
        COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.main.id
      },
      lookup(each.value, "environment_vars", {})
    )
  }

  tracing_config {
    mode = "PassThrough"
  }

  tags = merge(
    local.lambda_common_tags,
    {
      Name     = "${local.lambda_prefix}-${each.key}"
      Function = each.key
    }
  )

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_cognito_user_pool.main,
    aws_cognito_user_pool_client.main
  ]
}

# Lambda Authorizer (needs Cognito config)
resource "aws_lambda_function" "lambda_authorizer" {
  function_name = "${local.lambda_prefix}-lambda-authorizer"
  description   = local.lambda_functions["lambda_authorizer"].description
  role          = aws_iam_role.lambda_execution.arn
  handler       = local.lambda_functions["lambda_authorizer"].handler
  runtime       = local.lambda_functions["lambda_authorizer"].runtime
  timeout       = local.lambda_functions["lambda_authorizer"].timeout
  memory_size   = local.lambda_functions["lambda_authorizer"].memory_size

  filename         = data.archive_file.lambda_zip["lambda_authorizer"].output_path
  source_code_hash = data.archive_file.lambda_zip["lambda_authorizer"].output_base64sha256

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      REGION               = var.aws_region
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.main.id
    }
  }

  tracing_config {
    mode = "PassThrough"
  }

  tags = merge(
    local.lambda_common_tags,
    {
      Name     = "${local.lambda_prefix}-lambda-authorizer"
      Function = "lambda_authorizer"
    }
  )

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_cognito_user_pool.main,
    aws_cognito_user_pool_client.main
  ]
}

# Lambda Function URLs (optional - uncomment if needed)
# resource "aws_lambda_function_url" "function_urls" {
#   for_each = local.lambda_functions
#
#   function_name      = aws_lambda_function.functions[each.key].function_name
#   authorization_type = "NONE"
#
#   cors {
#     allow_credentials = true
#     allow_origins     = ["*"]
#     allow_methods     = ["*"]
#     allow_headers     = ["date", "keep-alive"]
#     expose_headers    = ["keep-alive", "date"]
#     max_age           = 86400
#   }
# }

# Event Source Mapping: DynamoDB Stream -> process-email-stream Lambda
resource "aws_lambda_event_source_mapping" "email_stream_to_push" {
  event_source_arn  = aws_dynamodb_table.email_tracking.stream_arn
  function_name     = aws_lambda_function.functions["process_email_stream"].arn
  starting_position = "LATEST"
  batch_size        = 10
  maximum_batching_window_in_seconds = 1
  parallelization_factor = 1

  # Only process INSERT events (new emails)
  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT"]
      })
    }
  }

  depends_on = [
    aws_lambda_function.functions,
    aws_dynamodb_table.email_tracking
  ]
}
