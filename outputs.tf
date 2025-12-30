output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "s3_bucket_name" {
  description = "The name of the S3 bucket"
  value       = aws_s3_bucket.website.id
}

output "s3_bucket_website_endpoint" {
  description = "The website endpoint of the S3 bucket"
  value       = aws_s3_bucket_website_configuration.website.website_endpoint
}

output "acm_certificate_arn" {
  description = "The ARN of the ACM certificate"
  value       = aws_acm_certificate.main.arn
}

output "route53_zone_id" {
  description = "The Route53 hosted zone ID"
  value       = data.aws_route53_zone.main.zone_id
}

output "domain_name" {
  description = "The primary domain name"
  value       = var.domain_name
}

output "redirect_target" {
  description = "A domain that traffic is redirected to"
  value       = var.redirect_target
}

output "ses" {
  description = "SES configuration for the domain"
  value = {
    domain_identity_arn = aws_ses_domain_identity.main.arn
  }
}
