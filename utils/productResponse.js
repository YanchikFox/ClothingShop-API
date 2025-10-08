const SUPPORTED_LANGUAGES = ['en', 'ru', 'uk'];
const DEFAULT_LANGUAGE = 'en';

const normalizeLanguageTag = (tag) => {
    if (!tag || typeof tag !== 'string') {
        return null;
    }
    const normalized = tag.trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    return normalized.split('-')[0];
};

const parseAcceptLanguageHeader = (headerValue) => {
    if (!headerValue || typeof headerValue !== 'string') {
        return [];
    }
    return headerValue
        .split(',')
        .map((part) => part.split(';')[0].trim())
        .filter(Boolean);
};

const parseJsonField = (value, fallback = []) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (value === null || value === undefined) {
        return fallback;
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (_err) {
            return fallback;
        }
    }

    if (typeof value === 'object') {
        return value;
    }

    return fallback;
};

const parseJsonObjectField = (value, fallback = {}) => {
    if (value === null || value === undefined) {
        return fallback;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        } catch (_err) {
            return fallback;
        }
    }

    return fallback;
};

const getLocalizedText = (baseValue, translations, language) => {
    const translationMap = parseJsonObjectField(translations, {});
    if (language && translationMap[language]) {
        return translationMap[language];
    }

    if (translationMap[DEFAULT_LANGUAGE]) {
        return translationMap[DEFAULT_LANGUAGE];
    }

    return baseValue ?? '';
};

const buildLocalizedFeatures = (row, language) => {
    const features = parseJsonField(row.features, []);
    if (!Array.isArray(features)) {
        return [];
    }

    return features.map((feature) => {
        const title = getLocalizedText(feature.title ?? '', feature.title_translations, language);
        const value = getLocalizedText(feature.value ?? '', feature.value_translations, language);

        return {
            title,
            value,
        };
    });
};

const buildImageList = (row) => {
    const images = parseJsonField(row.image_urls ?? row.imageUrls, []);
    if (images.length > 0) {
        return images;
    }

    return row.image_path ? [row.image_path] : [];
};

const parsePriceValue = (row) => {
    if (typeof row.price === 'number') {
        return row.price;
    }

    if (typeof row.price === 'string') {
        const numeric = Number.parseFloat(row.price);
        if (!Number.isNaN(numeric)) {
            return numeric;
        }
    }

    if (typeof row.price_string === 'string') {
        const cleaned = row.price_string.replace(/[^0-9.,-]/g, '').replace(',', '.');
        const numeric = Number.parseFloat(cleaned);
        if (!Number.isNaN(numeric)) {
            return numeric;
        }
    }

    return 0;
};

const resolveLanguage = (req) => {
    const queryLang = normalizeLanguageTag(req.query?.lang);
    if (queryLang && SUPPORTED_LANGUAGES.includes(queryLang)) {
        return queryLang;
    }

    const headerLanguages = parseAcceptLanguageHeader(req.headers['accept-language']);
    for (const lang of headerLanguages) {
        const normalized = normalizeLanguageTag(lang);
        if (normalized && SUPPORTED_LANGUAGES.includes(normalized)) {
            return normalized;
        }
    }

    return DEFAULT_LANGUAGE;
};

const toProductResponse = (row, language) => {
    const nameTranslations = row.name_translations ?? row.nameTranslations;
    const descriptionTranslations = row.description_translations ?? row.descriptionTranslations;
    const compositionTranslations = row.composition_translations ?? row.compositionTranslations;
    const careTranslations = row.care_instructions_translations ?? row.careInstructionsTranslations;

    return {
        id: row.id,
        article: row.article,
        category_id: row.category_id ?? row.gender ?? null,
        name: getLocalizedText(row.name, nameTranslations, language),
        description: getLocalizedText(row.description ?? '', descriptionTranslations, language),
        price: parsePriceValue(row),
        price_string: row.price_string ?? '',
        is_bestseller: Boolean(row.is_bestseller),
        imageUrls: buildImageList(row),
        image_path: row.image_path ?? null,
        composition: getLocalizedText(row.composition ?? '', compositionTranslations, language),
        careInstructions: getLocalizedText(
            row.care_instructions ?? row.careInstructions ?? '',
            careTranslations,
            language
        ),
        features: buildLocalizedFeatures(row, language),
        reviews: parseJsonField(row.reviews),
        gender: row.gender ?? row.category_id ?? null,
    };
};

const toCategoryResponse = (row, language) => ({
    id: row.id,
    name: getLocalizedText(row.name, row.name_translations, language),
    slug: row.slug ?? row.id,
    parent_id: row.parent_id ?? null,
    image_path: row.image_path ?? '',
    icon_path: row.icon_path ?? row.image_path ?? '',
});

module.exports = {
    resolveLanguage,
    toProductResponse,
    toCategoryResponse,
};
