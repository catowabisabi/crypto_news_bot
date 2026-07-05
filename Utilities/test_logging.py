

import logging
from core.class_logging import AppLogger
AppLogger.setup_logging()
logger = logging.getLogger()

# 使用獲取的logger記錄一條信息級別的日誌
logger.warning('This is an warning message.')
logger.error('This is an error message.')
logger.info('This is an info message.')
logger.critical('This is an critical message.')
logger.debug('This is an debug message.')