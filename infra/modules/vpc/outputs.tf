output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "db_subnet_group_name" {
  description = "Name of the DB subnet group"
  value       = var.create_db_subnet_group ? aws_db_subnet_group.main[0].name : ""
}
