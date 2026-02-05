output "api_endpoint" {
  description = "HTTP API endpoint URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "slack_request_url" {
  description = "URL to configure as Slack Request URL"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/slack/events"
}
