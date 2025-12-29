# Lambda Configuration
# Define your Lambda functions here by adding entries to the lambda_functions local variable

locals {
  # Define Lambda functions here - add new functions to this map
  # Note: Run 'npm run build:lambdas' before deploying to compile TypeScript
  lambda_functions = {
    # Example function (uncomment and customize):
    # example_function = {
    #   description     = "Example Lambda function"
    #   handler         = "example-function.handler"
    #   runtime         = "nodejs22.x"
    #   timeout         = 30
    #   memory_size     = 256
    #   source_dir      = "${path.module}/dist/lambdas/"
    #   environment_vars = {
    #     DOMAIN_NAME = var.domain_name
    #   }
    # }
  }

  # Common tags for all Lambda resources
  lambda_common_tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = "Email"
  }
}

# IAM Role for Lambda execution
resource "aws_iam_role" "lambda_execution" {
  name = "${var.domain_name}-lambda-execution-role"
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
      Name = "${var.domain_name}-lambda-execution-role"
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
  name = "${var.domain_name}-lambda-custom-policy"
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
      # Add additional permissions here as needed
      # Example: S3 access, DynamoDB, SES, etc.
    ]
  })
}

# CloudWatch Log Groups for Lambda functions
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = local.lambda_functions

  name              = "/aws/lambda/${var.domain_name}-${each.key}"
  retention_in_days = 14

  tags = merge(
    local.lambda_common_tags,
    {
      Name     = "${var.domain_name}-${each.key}-logs"
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

# Lambda Functions
resource "aws_lambda_function" "functions" {
  for_each = local.lambda_functions

  function_name = "${var.domain_name}-${each.key}"
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
      Name     = "${var.domain_name}-${each.key}"
      Function = each.key
    }
  )

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution
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
