# Local variables
locals {
  domain_names     = [var.domain_name, "www.${var.domain_name}"]
  sanitized_domain = replace(var.domain_name, ".", "-")
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Route53 Hosted Zone
data "aws_route53_zone" "main" {
  zone_id = var.route53_zone_id
}

# S3 Bucket for website (redirects to target domain)
resource "aws_s3_bucket" "website" {
  bucket = var.domain_name

  tags = {
    Name        = var.domain_name
    Environment = var.environment
  }
}

resource "aws_s3_bucket_website_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# ACM Certificate
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = var.domain_name
    Environment = var.environment
  }
}

# ACM validation CNAME records
resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.record]
}

# ACM Certificate Validation
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront distribution for ${var.domain_name}"
  default_root_object = ""
  aliases             = local.domain_names
  price_class         = var.cloudfront_price_class
  http_version        = "http2"
  web_acl_id          = var.waf_web_acl_id

  tags = {
    Name        = var.domain_name
    Environment = var.environment
  }

  origin {
    domain_name = aws_s3_bucket_website_configuration.website.website_endpoint
    origin_id   = "S3-${aws_s3_bucket.website.id}"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }
  }

  # API Gateway origin
  origin {
    domain_name = replace(aws_apigatewayv2_api.main.api_endpoint, "https://", "")
    origin_id   = "API-Gateway"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # API routes - no caching, forward all headers/cookies
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "API-Gateway"

    viewer_protocol_policy = "https-only"
    compress               = false

    # Use managed cache policy for no caching
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled

    # Forward all headers, query strings, and cookies
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.website.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  depends_on = [aws_acm_certificate_validation.main]
}

# DNS Records for CloudFront
resource "aws_route53_record" "cloudfront" {
  for_each = toset(local.domain_names)

  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_ses_configuration_set" "main" {
  name = "${local.sanitized_domain}-config-set"
}

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

resource "aws_route53_record" "main_amazonses_verification_record" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "_amazonses.${aws_ses_domain_identity.main.domain}"
  type    = "TXT"
  ttl     = "600"
  records = [aws_ses_domain_identity.main.verification_token]
}

resource "aws_ses_domain_identity_verification" "main_verification" {
  domain = aws_ses_domain_identity.main.domain

  depends_on = [aws_route53_record.main_amazonses_verification_record]
}
# DKIM for SES
resource "aws_ses_domain_dkim" "main_dkim" {
  domain = aws_ses_domain_identity.main.domain
}
resource "aws_route53_record" "main_amazonses_dkim_records" {
  count = 3

  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${aws_ses_domain_dkim.main_dkim.dkim_tokens[count.index]}._domainkey.${aws_ses_domain_identity.main.domain}"
  type    = "CNAME"
  ttl     = "600"
  records = ["${aws_ses_domain_dkim.main_dkim.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# SES Mail From Domain
resource "aws_ses_domain_mail_from" "main_mail_from" {
  domain                 = aws_ses_domain_identity.main.domain
  mail_from_domain       = "mail.${var.domain_name}"
  behavior_on_mx_failure = "UseDefaultValue"
}
resource "aws_route53_record" "main_mail_from_mx" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = aws_ses_domain_mail_from.main_mail_from.mail_from_domain
  type    = "MX"
  ttl     = "600"
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}
resource "aws_route53_record" "main_mail_from_spf" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = aws_ses_domain_mail_from.main_mail_from.mail_from_domain
  type    = "TXT"
  ttl     = "600"
  records = ["v=spf1 include:amazonses.com -all"]
}

# MX Records for receiving emails via SES
resource "aws_route53_record" "main_mx" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = "600"
  records = ["10 inbound-smtp.${var.aws_region}.amazonaws.com."]
}

# Receiving SES Emails

# Bucket to store received emails
resource "aws_s3_bucket" "ses_received_emails" {
  bucket = "${var.domain_name}-ses-emails"
  tags = {
    Name        = "${var.domain_name}-ses-emails"
    Environment = var.environment
  }
}
# IAM Role for SES to write to S3
resource "aws_iam_role" "ses_s3_role" {
  name = "${local.sanitized_domain}-ses-s3-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
      }
    ]
  })
  tags = {
    Name        = "${local.sanitized_domain}-ses-s3-role"
    Environment = var.environment
  }
}

# IAM Policy for SES to write to S3
resource "aws_iam_role_policy" "ses_s3_policy" {
  name = "${local.sanitized_domain}-ses-s3-policy"
  role = aws_iam_role.ses_s3_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetBucketLocation",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.ses_received_emails.arn,
          "${aws_s3_bucket.ses_received_emails.arn}/*"
        ]
      }
    ]
  })
}

# S3 Bucket Policy to allow SES to write emails
resource "aws_s3_bucket_policy" "ses_received_emails_policy" {
  bucket = aws_s3_bucket.ses_received_emails.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPuts"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = ["s3:PutObject", "s3:PutObjectAcl"]
        Resource = "${aws_s3_bucket.ses_received_emails.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# SES Receipt Rule Set
resource "aws_ses_receipt_rule_set" "main_rule_set" {
  rule_set_name = "${local.sanitized_domain}-rule-set"
}

# Lambda permission for SES to invoke the function
resource "aws_lambda_permission" "ses_lambda_permission" {
  statement_id  = "AllowExecutionFromSES"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["receive_ses_email"].function_name
  principal     = "ses.amazonaws.com"
}

# SES Receipt Rule to store raw email in S3 and process via Lambda
resource "aws_ses_receipt_rule" "store_in_s3_rule" {
  name          = "ProcessWithLambdaAndStoreInS3"
  rule_set_name = aws_ses_receipt_rule_set.main_rule_set.rule_set_name
  enabled       = true
  recipients    = [var.domain_name]
  scan_enabled  = false

  s3_action {
    position          = 1
    bucket_name       = aws_s3_bucket.ses_received_emails.id
    object_key_prefix = "incoming/"
  }

  lambda_action {
    position        = 2
    function_arn    = aws_lambda_function.functions["receive_ses_email"].arn
    invocation_type = "Event"
  }

  depends_on = [
    aws_lambda_permission.ses_lambda_permission,
    aws_lambda_function.functions,
    aws_s3_bucket_policy.ses_received_emails_policy
  ]
}

# set the rule set as active
resource "aws_ses_active_receipt_rule_set" "active_rule_set" {
  rule_set_name = aws_ses_receipt_rule_set.main_rule_set.rule_set_name
}
