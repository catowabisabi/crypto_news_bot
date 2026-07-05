from core.class_logging import logger

class InfoDisplay:
    def __init__(self):
        pass

    def show_news_court(self,new_news_count):
        if new_news_count == 0:
                logger.info("沒有新的新聞\n")
        else:
            logger.info(f"發現 {new_news_count} 條新的新聞\n")
        logger.info("=" * 30)