# AEGIS Orchestration Makefile

.PHONY: setup up down build test lint logs

setup:
	@echo "Setting up AEGIS infrastructure..."
	cd ai && npm install
	cd dashboard && npm install
	cp .env.example .env

up:
	@echo "Starting AEGIS services..."
	docker-compose up -d

down:
	@echo "Stopping AEGIS services..."
	docker-compose down

build:
	@echo "Building AEGIS images..."
	docker-compose build

logs:
	@echo "Streaming system logs..."
	docker-compose logs -f

clean:
	@echo "Cleaning up..."
	rm -rf ai/node_modules dashboard/node_modules
