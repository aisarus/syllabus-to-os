export const topicInputPattern =
  /<Input(?=[^>]*\bvalue=\{newTopic\})(?=[^>]*\baria-label=\{\s*isRu\s*\?\s*"Название новой темы"\s*:\s*"New topic title"\s*\})[^>]*\/?\s*>/;

export const uploadTopicPattern =
  /<SelectTrigger(?=[^>]*\baria-label=\{\s*isRu\s*\?\s*"Тема для загружаемого материала"\s*:\s*"Topic for uploaded material"\s*\})[^>]*>/;

export const extractedChunkTitleDirectionPattern =
  /<strong(?=[^>]*\bdir="auto")(?=[^>]*\bclassName="[^"]*\bblock\b[^"]*\btruncate\b[^"]*")[^>]*>\s*\{chunk\.title/;

export const extractedChunkTextDirectionPattern =
  /<span(?=[^>]*\bdir="auto")(?=[^>]*\bclassName="[^"]*\bline-clamp-2\b[^"]*")[^>]*>\s*\{chunk\.text\}/;

export const linkedMaterialTitleDirectionPattern =
  /<strong(?=[^>]*\bdir="auto")(?=[^>]*\bclassName="[^"]*\btruncate\b[^"]*\bhover:text-primary\b[^"]*")[^>]*>\s*\{material\.title\}/;
