variable "domain_name" {
  description = "The primary domain name"
  type        = string
  default     = "macconnachie.com"
}

variable "redirect_target" {
  description = "The domain to redirect all traffic to"
  type        = string
  default     = "csm.codes"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
  default     = "Z019379591TVAYJZ90V8"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "Production"
}

variable "cloudfront_price_class" {
  description = "CloudFront distribution price class"
  type        = string
  default     = "PriceClass_All"
}

variable "waf_web_acl_id" {
  description = "WAF Web ACL ID for CloudFront"
  type        = string
  default     = "arn:aws:wafv2:us-east-1:472312425428:global/webacl/CreatedByCloudFront-54d85d51/308467e4-0a19-49f8-afdf-1d411fcd780d"
}
