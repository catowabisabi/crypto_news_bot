from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
from opencc import OpenCC
from nltk.tokenize import sent_tokenize
from core.class_logging import logger

# 使用AI來Translate
class EnglishToChineseTranslator: 
    def __init__(self, model_name="liam168/trans-opus-mt-en-zh"):
 
        self.tokenizer  = AutoTokenizer.from_pretrained(model_name)
        self.model      = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        self.translation_pipeline = pipeline("translation_en_to_zh", model=self.model, tokenizer=self.tokenizer)
        self.max_length = 512  # 增加模型的最大长度限制

    def translate(self, text, max_length=None): # 英轉中
        parts = self._smart_split(text, max_length)
        translated_parts = [self._translate_part(part) for part in parts]
        content = ' '.join(translated_parts)
        cc = OpenCC('s2t')
        zh_text = cc.convert(content)
        logger.debug(zh_text)
        logger.debug("\n")
        return zh_text

    def _smart_split(self, text, max_length=None):
        if max_length is None:
            max_length = self.max_length

        sentences = sent_tokenize(text)
        current_part = ''
        parts = []

        for sentence in sentences:
            # 如果当前部分加上新句子超过最大长度，则将当前部分保存并开始新的部分
            if len(self.tokenizer.encode(current_part + sentence, add_special_tokens=True)) + 1 > max_length:
                # +1 是为了考虑到可能的EOS token
                parts.append(current_part.strip())
                current_part = sentence + ' '
            else:
                current_part += sentence + ' '

        if current_part:
            parts.append(current_part.strip())

        return parts

    def _translate_part(self, part):
        result = self.translation_pipeline(part)
        return result[0]['translation_text']