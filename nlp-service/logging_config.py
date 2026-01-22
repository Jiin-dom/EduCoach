"""
Custom logging configuration for NLP service
Filters out health check endpoint requests to reduce log spam
"""
import logging


class HealthCheckFilter(logging.Filter):
    """
    Filter out health check requests from logs.
    
    This prevents Docker's health check from flooding the logs
    with repetitive /health endpoint requests every 30 seconds.
    """
    
    def filter(self, record: logging.LogRecord) -> bool:
        """
        Return False if this is a health check request, True otherwise.
        
        Args:
            record: The log record to check
            
        Returns:
            bool: False to filter out (ignore), True to keep the log
        """
        # Get the message from the log record
        message = record.getMessage()
        
        # Filter out health check requests
        # These come from Docker's healthcheck hitting GET /health
        if 'GET /health' in message or 'GET /health HTTP' in message:
            return False
        
        # Keep all other log messages
        return True


# Uvicorn logging configuration
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "health_check_filter": {
            "()": HealthCheckFilter,
        }
    },
    "formatters": {
        "default": {
            "format": "%(levelprefix)s %(asctime)s - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "access": {
            "format": '%(levelprefix)s %(asctime)s - %(client_addr)s - "%(request_line)s" %(status_code)s',
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        },
        "access": {
            "formatter": "access",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "filters": ["health_check_filter"],  # Apply the filter here
        },
    },
    "loggers": {
        "uvicorn": {
            "handlers": ["default"],
            "level": "INFO",
            "propagate": False,
        },
        "uvicorn.error": {
            "level": "INFO",
        },
        "uvicorn.access": {
            "handlers": ["access"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
