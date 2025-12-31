# HTTP API Gateway
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.domain_name}-api"
  protocol_type = "HTTP"
  description   = "Email system API"

  tags = {
    Name        = "${var.domain_name}-api"
    Environment = var.environment
  }
}

# Default Stage (auto-deploy)
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 500
    throttling_rate_limit  = 100
  }

  tags = {
    Name        = "${var.domain_name}-api-stage"
    Environment = var.environment
  }
}

# Lambda Authorizer (validates JWT from cookies)
resource "aws_apigatewayv2_authorizer" "lambda" {
  api_id                            = aws_apigatewayv2_api.main.id
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = aws_lambda_function.lambda_authorizer.invoke_arn
  identity_sources                  = ["$request.header.Cookie"]
  name                              = "lambda-authorizer"
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = false
  authorizer_result_ttl_in_seconds  = 300
}

# Permission for API Gateway to invoke Lambda authorizer
resource "aws_lambda_permission" "api_gateway_authorizer" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/authorizers/${aws_apigatewayv2_authorizer.lambda.id}"
}

# Lambda Integrations
# Auth Routes (public - no authorizer)
resource "aws_apigatewayv2_integration" "request_otp" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth_api_functions["request_otp"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "verify_otp" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth_api_functions["verify_otp"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Protected Routes (require Cognito JWT)
resource "aws_apigatewayv2_integration" "logout" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth_api_functions["logout"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "send_email" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions["send_email"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "list_emails" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions["list_emails"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_full_email" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions["get_full_email"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "update_email" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions["update_email"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_thread_emails" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions["get_thread_emails"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_attachment_upload_presign" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions["get_attachment_upload_presign"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Routes - Public (No Auth)
resource "aws_apigatewayv2_route" "request_otp" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/auth/request-otp"
  target    = "integrations/${aws_apigatewayv2_integration.request_otp.id}"
}

resource "aws_apigatewayv2_route" "verify_otp" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/auth/verify-otp"
  target    = "integrations/${aws_apigatewayv2_integration.verify_otp.id}"
}

# Routes - Protected (Require Lambda Authorization)
resource "aws_apigatewayv2_route" "logout" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /api/auth/logout"
  target             = "integrations/${aws_apigatewayv2_integration.logout.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda.id
}

resource "aws_apigatewayv2_route" "send_email" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /api/emails/send"
  target             = "integrations/${aws_apigatewayv2_integration.send_email.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda.id
}

resource "aws_apigatewayv2_route" "list_emails" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /api/emails/list"
  target             = "integrations/${aws_apigatewayv2_integration.list_emails.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda.id
}

resource "aws_apigatewayv2_route" "get_full_email" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /api/emails/detail"
  target             = "integrations/${aws_apigatewayv2_integration.get_full_email.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda.id
}

resource "aws_apigatewayv2_route" "update_email" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /api/emails/update"
  target             = "integrations/${aws_apigatewayv2_integration.update_email.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda.id
}

resource "aws_apigatewayv2_route" "get_thread_emails" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /api/emails/thread"
  target             = "integrations/${aws_apigatewayv2_integration.get_thread_emails.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda.id
}

resource "aws_apigatewayv2_route" "get_attachment_upload_presign" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /api/attachments/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.get_attachment_upload_presign.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda.id
}

# Lambda Permissions for API Gateway to invoke functions
resource "aws_lambda_permission" "api_gateway_request_otp" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_api_functions["request_otp"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_verify_otp" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_api_functions["verify_otp"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_logout" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_api_functions["logout"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_send_email" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["send_email"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_list_emails" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["list_emails"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_get_full_email" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["get_full_email"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_update_email" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["update_email"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_get_thread_emails" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["get_thread_emails"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_get_attachment_upload_presign" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["get_attachment_upload_presign"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Outputs
output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.main.id
}
