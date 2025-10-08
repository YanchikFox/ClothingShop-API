require('dotenv').config();

const { Pool } = require('pg');

const {
    DATABASE_URL,
    DB_HOST = 'localhost',
    DB_PORT = '5432',
    DB_USER = 'myuser',
    DB_PASSWORD = 'mypassword',
    DB_NAME = 'mydatabase',
    DB_SSL = 'false',
} = process.env;

console.log('▶️ Database setup script started...');

const poolConfig = DATABASE_URL
    ? { connectionString: DATABASE_URL }
    : {
          host: DB_HOST,
          port: Number(DB_PORT),
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
      };

if (DB_SSL === 'true') {
    poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

const setupQuery = `
    DROP TABLE IF EXISTS cart_items;
    DROP TABLE IF EXISTS carts;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS user_addresses;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        phone_number VARCHAR(50),
        language_preference VARCHAR(10),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        parent_id VARCHAR(50) REFERENCES categories(id),
        image_path VARCHAR(255) NOT NULL,
        icon_path VARCHAR(255) NOT NULL,
        name_translations JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE products (
        id VARCHAR(50) PRIMARY KEY,
        article VARCHAR(50) UNIQUE NOT NULL,
        category_id VARCHAR(50) REFERENCES categories(id),
        image_path VARCHAR(255) NOT NULL,
        image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        price_string VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
        gender VARCHAR(10) NOT NULL CHECK (gender IN ('men', 'women', 'unisex')),
        brand VARCHAR(100) NOT NULL,
        color VARCHAR(100) NOT NULL,
        sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
        composition TEXT DEFAULT '',
        care_instructions TEXT DEFAULT '',
        features JSONB NOT NULL DEFAULT '[]'::jsonb,
        reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
        name_translations JSONB NOT NULL DEFAULT '{}'::jsonb,
        description_translations JSONB NOT NULL DEFAULT '{}'::jsonb,
        composition_translations JSONB NOT NULL DEFAULT '{}'::jsonb,
        care_instructions_translations JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE carts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        UNIQUE (cart_id, product_id)
    );

    CREATE TABLE user_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label VARCHAR(100) NOT NULL,
        line1 VARCHAR(255) NOT NULL,
        line2 VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        postal_code VARCHAR(20) NOT NULL,
        country VARCHAR(100) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_number VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        total_amount VARCHAR(50) NOT NULL,
        placed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_categories_slug ON categories(slug);
    CREATE INDEX idx_categories_parent ON categories(parent_id);
    CREATE INDEX idx_products_category ON products(category_id);
    CREATE INDEX idx_products_gender ON products(gender);
    CREATE INDEX idx_products_brand ON products(brand);
    CREATE INDEX idx_products_price ON products(price);
    CREATE INDEX idx_products_category_gender ON products(category_id, gender);
`;

const t = (en, ru, uk, pl) => ({ en, ru, uk, pl });

const languages = ['en', 'ru', 'uk', 'pl'];

const categories = [
    {
        id: 'outerwear',
        name: 'Outerwear',
        slug: 'outerwear',
        parent_id: null,
        image_path: 'images/categories/outerwear.jpg',
        icon_path: 'images/categories/icons/outerwear.svg',
        name_translations: t('Outerwear', 'Верхняя одежда', 'Верхній одяг', 'Odzież wierzchnia'),
    },
    {
        id: 'knitwear',
        name: 'Knitwear',
        slug: 'knitwear',
        parent_id: null,
        image_path: 'images/categories/knitwear.jpg',
        icon_path: 'images/categories/icons/knitwear.svg',
        name_translations: t('Knitwear', 'Трикотаж', 'Трикотаж', 'Dzianina'),
    },
    {
        id: 'denim',
        name: 'Denim',
        slug: 'denim',
        parent_id: null,
        image_path: 'images/categories/denim.jpg',
        icon_path: 'images/categories/icons/denim.svg',
        name_translations: t('Denim', 'Деним', 'Деним', 'Denim'),
    },
    {
        id: 'footwear',
        name: 'Footwear',
        slug: 'footwear',
        parent_id: null,
        image_path: 'images/categories/footwear.jpg',
        icon_path: 'images/categories/icons/footwear.svg',
        name_translations: t('Footwear', 'Обувь', 'Взуття', 'Obuwie'),
    },
    {
        id: 'accessories',
        name: 'Accessories',
        slug: 'accessories',
        parent_id: null,
        image_path: 'images/categories/accessories.jpg',
        icon_path: 'images/categories/icons/accessories.svg',
        name_translations: t('Accessories', 'Аксессуары', 'Аксесуари', 'Akcesoria'),
    },
    {
        id: 'sportswear',
        name: 'Sportswear',
        slug: 'sportswear',
        parent_id: null,
        image_path: 'images/categories/sportswear.jpg',
        icon_path: 'images/categories/icons/sportswear.svg',
        name_translations: t('Sportswear', 'Спортивная одежда', 'Спортивний одяг', 'Odzież sportowa'),
    },
    {
        id: 'dresses',
        name: 'Dresses',
        slug: 'dresses',
        parent_id: null,
        image_path: 'images/categories/dresses.jpg',
        icon_path: 'images/categories/icons/dresses.svg',
        name_translations: t('Dresses', 'Платья', 'Сукні', 'Sukienki'),
    },
    {
        id: 'tailoring',
        name: 'Tailoring',
        slug: 'tailoring',
        parent_id: null,
        image_path: 'images/categories/tailoring.jpg',
        icon_path: 'images/categories/icons/tailoring.svg',
        name_translations: t('Tailoring', 'Классика', 'Класика', 'Krawiectwo'),
    },
];

const brands = [
    'NordCraft',
    'UrbanEdge',
    'VitalForm',
    'EvolveWear',
    'Heritage Threads',
    'CozyPeak',
    'FlowMotion',
    'AeroStudio',
    'Harbor & Co.',
    'Sierra Atelier',
    'Linea Baltic',
    'Mountain Assembly',
];

const colors = [
    { key: 'charcoal', translations: t('Charcoal', 'Графитовый', 'Графітовий', 'Grafitowy') },
    { key: 'navy', translations: t('Navy', 'Темно-синий', 'Темно-синій', 'Granatowy') },
    { key: 'sage', translations: t('Sage', 'Шалфейный', 'Шавлієвий', 'Szałwiowy') },
    { key: 'amber', translations: t('Amber', 'Янтарный', 'Бурштиновий', 'Bursztynowy') },
    { key: 'ivory', translations: t('Ivory', 'Молочный', 'Молочний', 'Kremowy') },
    { key: 'cobalt', translations: t('Cobalt', 'Кобальтовый', 'Кобальтовий', 'Kobaltowy') },
    { key: 'terracotta', translations: t('Terracotta', 'Терракотовый', 'Теракотовий', 'Terakotowy') },
    { key: 'forest', translations: t('Forest', 'Хвойный', 'Хвойний', 'Leśny') },
    { key: 'sand', translations: t('Sand', 'Песочный', 'Піщаний', 'Piaskowy') },
    { key: 'storm', translations: t('Storm', 'Стальной', 'Сталевий', 'Stalowy') },
    { key: 'blush', translations: t('Blush', 'Пудровый', 'Пудровий', 'Pudrowy') },
    { key: 'slate', translations: t('Slate', 'Сланцевый', 'Сланцевий', 'Łupkowy') },
];

const sizeSets = {
    outerwear: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    knitwear: ['XS', 'S', 'M', 'L', 'XL'],
    denim: ['24', '26', '28', '30', '32', '34', '36'],
    footwear: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
    accessories: ['One Size'],
    sportswear: ['XS', 'S', 'M', 'L', 'XL'],
    dresses: ['XS', 'S', 'M', 'L', 'XL'],
    tailoring: ['44', '46', '48', '50', '52', '54'],
};

const descriptionTemplate = {
    en: '{brand} presents the {styleName} in a {color} tone highlighted by {detail}.',
    ru: '{brand} представляет {styleName} в оттенке {color} и выделяется {detail}.',
    uk: '{brand} презентує {styleName} у відтінку {color} та вирізняється {detail}.',
    pl: '{brand} prezentuje {styleName} w odcieniu {color} i wyróżnia się {detail}.',
};
const styles = [
    {
        key: 'insulated-parka',
        categoryId: 'outerwear',
        names: t('Insulated Parka', 'Утепленная парка', 'Утеплена парка', 'Parka ocieplana'),
        detail: t('storm-ready seams and a detachable hood', 'защитными швами и съемным капюшоном', 'захисними швами та знімним капюшоном', 'uszczelnionymi szwami i odpinanym kapturem'),
        note: t('Finished with recycled trims for everyday durability.', 'Дополнена переработанной фурнитурой для повседневной надежности.', 'Доповнена переробленою фурнітурою для щоденної надійності.', 'Uzupełniona recyklingowaną galanterią dla codziennej wytrzymałości.'),
        composition: t('Shell: 100% recycled polyester; Lining: 100% nylon; Fill: 100% recycled polyester', 'Верх: 100% переработанный полиэстер; Подкладка: 100% нейлон; Наполнитель: 100% переработанный полиэстер', 'Верх: 100% перероблений поліестер; Підкладка: 100% нейлон; Наповнювач: 100% перероблений поліестер', 'Wierzch: 100% poliester z recyklingu; Podszewka: 100% nylon; Wypełnienie: 100% poliester z recyklingu'),
        care: t('Machine wash cold separately and hang to dry.', 'Стирать отдельно в холодной воде и сушить на вешалке.', 'Прати окремо в холодній воді та сушити на тремпелі.', 'Prać oddzielnie w zimnej wodzie i suszyć na wieszaku.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'outerwear',
        minPrice: 2850,
        maxPrice: 3650,
        features: [
            {
                title: t('Warmth rating', 'Уровень тепла', 'Рівень тепла', 'Poziom ciepła'),
                value: t('Engineered for -10°C to +5°C', 'Комфортно от -10°C до +5°C', 'Комфортно від -10°C до +5°C', 'Komfort od -10°C do +5°C'),
            },
            {
                title: t('Fabric finish', 'Защитное покрытие', 'Захисне покриття', 'Wykończenie tkaniny'),
                value: t('Durable water repellent', 'Водоотталкивающее покрытие', 'Водостійке покриття', 'Hydrofobowa powłoka'),
            },
        ],
    },
    {
        key: 'double-wool-coat',
        categoryId: 'outerwear',
        names: t('Double-Face Wool Coat', 'Двустороннее шерстяное пальто', 'Двобічне вовняне пальто', 'Dwustronny płaszcz wełniany'),
        detail: t('hand-finished edges and waist belt', 'ручной отделкой краев и поясом', 'ручним оздобленням країв та поясом', 'ręcznie wykończonymi krawędziami i paskiem'),
        note: t('Soft brushed interior keeps warmth without bulk.', 'Мягкая ворсовая изнанка сохраняет тепло без объема.', 'М’яка ворсова виворіт зберігає тепло без зайвого об’єму.', 'Miękki meszek od środka utrzymuje ciepło bez dodawania objętości.'),
        composition: t('Shell: 80% wool, 20% recycled polyamide', 'Верх: 80% шерсть, 20% переработанный полиамид', 'Верх: 80% вовна, 20% перероблений поліамід', 'Wierzch: 80% wełna, 20% poliamid z recyklingu'),
        care: t('Dry clean only to preserve the finish.', 'Только химчистка для сохранения отделки.', 'Тільки хімчистка, щоб зберегти оздоблення.', 'Czyścić chemicznie, aby zachować wykończenie.'),
        genderOptions: ['women', 'unisex'],
        sizeSet: 'outerwear',
        minPrice: 3250,
        maxPrice: 4550,
        features: [
            {
                title: t('Weave', 'Плетение', 'Плетіння', 'Splot'),
                value: t('Double-face twill', 'Двусторонний саржевый', 'Двобічний саржевий', 'Dwustronny skośny'),
            },
            {
                title: t('Lining', 'Подкладка', 'Підкладка', 'Podszewka'),
                value: t('Unlined for fluid drape', 'Без подкладки для мягкого драпирования', 'Без підкладки для м’якого драпірування', 'Bez podszewki dla miękkiego układania'),
            },
        ],
    },
    {
        key: 'rain-shell',
        categoryId: 'outerwear',
        names: t('Lightweight Rain Shell', 'Легкая мембранная куртка', 'Легка мембранна куртка', 'Lekka kurtka membranowa'),
        detail: t('sealed seams and packable hood', 'проклеенными швами и складывающимся капюшоном', 'проклеєними швами та складаним капюшоном', 'podklejonymi szwami i chowanym kapturem'),
        note: t('Packs into its own pocket for travel-ready storage.', 'Складывается в собственный карман для удобного хранения.', 'Складається у власну кишеню для зручного зберігання.', 'Składa się do własnej kieszeni, co ułatwia podróżowanie.'),
        composition: t('Shell: 100% recycled polyester membrane', 'Верх: 100% переработанный полиэстер с мембраной', 'Верх: 100% перероблений поліестер з мембраною', 'Wierzch: 100% poliester z recyklingu z membraną'),
        care: t('Machine wash cold, close all zippers before washing.', 'Стирать в холодной воде, застегнув все молнии.', 'Прати в холодній воді, застібнувши всі блискавки.', 'Prać w zimnej wodzie z zapiętymi zamkami.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'outerwear',
        minPrice: 2150,
        maxPrice: 2980,
        features: [
            {
                title: t('Waterproof rating', 'Водонепроницаемость', 'Водонепроникність', 'Wodoodporność'),
                value: t('10 000 mm hydrostatic head', '10 000 мм водяного столба', '10 000 мм водяного стовпа', 'Słup wody 10 000 mm'),
            },
            {
                title: t('Ventilation', 'Вентиляция', 'Вентиляція', 'Wentylacja'),
                value: t('Laser-cut back yoke vents', 'Перфорация на кокетке спины', 'Перфорація на кокетці спини', 'Laserowe otwory na karczku'),
            },
        ],
    },
    {
        key: 'merino-crew',
        categoryId: 'knitwear',
        names: t('Merino Crew', 'Мериносовый джемпер', 'Мериносовий джемпер', 'Sweter z merynosa'),
        detail: t('fully-fashioned shoulders and rib trims', 'цельновязанными плечами и резинкой по краям', 'цільнов’язаними плечима та резинкою по краях', 'formowanymi ramionami i ściągaczami'),
        note: t('Breathable fibers regulate temperature year-round.', 'Дышащие волокна регулируют температуру круглый год.', 'Дихаючі волокна регулюють температуру впродовж року.', 'Oddychające włókna regulują temperaturę przez cały rok.'),
        composition: t('100% extra-fine merino wool', '100% мериносовая шерсть extra-fine', '100% вовна меринос extra-fine', '100% wełna merynos extra-fine'),
        care: t('Hand wash cold or dry clean. Lay flat to dry.', 'Ручная стирка в холодной воде или химчистка. Сушить горизонтально.', 'Ручне прання в холодній воді або хімчистка. Сушити горизонтально.', 'Prać ręcznie w zimnej wodzie lub czyścić chemicznie. Suszyć na płasko.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'knitwear',
        minPrice: 1850,
        maxPrice: 2550,
        features: [
            {
                title: t('Gauge', 'Класс вязки', 'Клас в’язки', 'Grubość dzianiny'),
                value: t('14-gauge compact knit', '14-й класс компактной вязки', '14-й клас компактної в’язки', 'Kompaktowa dzianina 14 gg'),
            },
            {
                title: t('Softness', 'Мягкость', 'М’якість', 'Miękkość'),
                value: t('No-itch merino fibers', 'Не колется благодаря волокнам мериноса', 'Не колеться завдяки волокнам мериноса', 'Niegryzące włókna merynosa'),
            },
        ],
    },
    {
        key: 'cable-cardigan',
        categoryId: 'knitwear',
        names: t('Cable Cardigan', 'Кардиган с косами', 'Кардиган із косами', 'Kardigan w warkocze'),
        detail: t('shawl collar and horn buttons', 'шальевым воротником и пуговицами под рог', 'шальовим коміром і ґудзиками під ріг', 'kołnierzem szalowym i guzikami z rogu'),
        note: t('Chunky pattern adds structure for layering.', 'Фактурная вязка добавляет структуру для многослойных образов.', 'Фактурне плетіння додає структуру для багатошарових образів.', 'Wyrazisty splot dodaje struktury w warstwowych stylizacjach.'),
        composition: t('70% wool, 20% alpaca, 10% recycled polyamide', '70% шерсть, 20% альпака, 10% переработанный полиамид', '70% вовна, 20% альпака, 10% перероблений поліамід', '70% wełna, 20% alpaka, 10% poliamid z recyklingu'),
        care: t('Dry flat after reshaping to measurements.', 'Сушить на плоскости, вернув исходную форму.', 'Сушити на пласкій поверхні, відновивши форму.', 'Suszyć na płasko po uformowaniu.'),
        genderOptions: ['women', 'unisex'],
        sizeSet: 'knitwear',
        minPrice: 1950,
        maxPrice: 2850,
        features: [
            {
                title: t('Cable pattern', 'Узор косы', 'Візерунок коси', 'Wzór warkocza'),
                value: t('Heritage-inspired braids', 'Узоры, вдохновленные наследием', 'Узори, натхнені спадщиною', 'Splot inspirowany tradycją'),
            },
            {
                title: t('Closure', 'Застежка', 'Застібка', 'Zapięcie'),
                value: t('Five-button front', 'Пять пуговиц спереди', 'П’ять ґудзиків спереду', 'Pięć guzików z przodu'),
            },
        ],
    },
    {
        key: 'cashmere-turtleneck',
        categoryId: 'knitwear',
        names: t('Cashmere Turtleneck', 'Кашемировая водолазка', 'Кашемірова водолазка', 'Golf z kaszmiru'),
        detail: t('rolled neckline and seamless body', 'скатанным воротником и бесшовным корпусом', 'скрученим коміром і безшовним корпусом', 'rolowanym golfem i bezszwowym korpusem'),
        note: t('Ultralight loft makes it ideal for layering under jackets.', 'Сверхлегкая фактура идеальна для ношения под пиджаками.', 'Надлегка фактура ідеальна під жакети.', 'Ultralekka przędza idealnie sprawdza się pod marynarką.'),
        composition: t('98% cashmere, 2% elastane', '98% кашемир, 2% эластан', '98% кашемір, 2% еластан', '98% kaszmir, 2% elastan'),
        care: t('Hand wash with cashmere shampoo and dry flat.', 'Ручная стирка шампунем для кашемира и сушка на плоскости.', 'Ручне прання шампунем для кашеміру та сушка на пласкій поверхні.', 'Prać ręcznie w szamponie do kaszmiru i suszyć na płasko.'),
        genderOptions: ['women'],
        sizeSet: 'knitwear',
        minPrice: 2850,
        maxPrice: 3650,
        features: [
            {
                title: t('Fiber source', 'Источник волокна', 'Походження волокна', 'Pochodzenie włókna'),
                value: t('Inner-Mongolian cashmere', 'Кашемир из Внутренней Монголии', 'Кашемір з Внутрішньої Монголії', 'Kaszmir z Mongolii Wewnętrznej'),
            },
            {
                title: t('Stretch', 'Эластичность', 'Еластичність', 'Elastyczność'),
                value: t('Comfort rib with gentle recovery', 'Комфортная резинка с мягким восстановлением', 'Комфортна резинка з м’яким відновленням', 'Elastyczny ściągacz o delikatnym powrocie'),
            },
        ],
    },
    {
        key: 'straight-jeans',
        categoryId: 'denim',
        names: t('Straight Jeans', 'Прямые джинсы', 'Прямі джинси', 'Jeansy proste'),
        detail: t('mid-rise block and signature topstitching', 'средней посадкой и фирменной отстрочкой', 'середньою посадкою та фірмовою відстрочкою', 'średnim stanem i charakterystycznymi przeszyciami'),
        note: t('Classic fit that works across sneakers or boots.', 'Классический крой сочетается и с кедами, и с ботинками.', 'Класичний крій пасує і до кросівок, і до черевиків.', 'Klasyczny krój pasuje zarówno do sneakersów, jak i butów.'),
        composition: t('99% organic cotton, 1% elastane', '99% органический хлопок, 1% эластан', '99% органічна бавовна, 1% еластан', '99% bawełna organiczna, 1% elastan'),
        care: t('Wash inside out on cold cycle. Line dry.', 'Стирать вывернув наизнанку в холодной воде. Сушить вертикально.', 'Прати навиворіт у холодній воді. Сушити вертикально.', 'Prać na lewej stronie w zimnej wodzie. Suszyć w pozycji pionowej.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'denim',
        minPrice: 1650,
        maxPrice: 2250,
        features: [
            {
                title: t('Denim weight', 'Плотность денима', 'Щільність деніму', 'Gramatura denimu'),
                value: t('12.5 oz raw finish', '12,5 унций, необработанный финиш', '12,5 унцій, необроблений фініш', '12,5 oz w surowym wykończeniu'),
            },
            {
                title: t('Rise', 'Посадка', 'Посадка', 'Stan'),
                value: t('Mid-rise straight block', 'Средняя посадка, прямой силуэт', 'Середня посадка, прямий силует', 'Średni stan, prosty krój'),
            },
        ],
    },
    {
        key: 'relaxed-jeans',
        categoryId: 'denim',
        names: t('Relaxed Taper Jean', 'Зауженные джинсы relaxed', 'Завужені relaxed джинси', 'Jeansy relaxed tapered'),
        detail: t('tapered leg and articulated knee darts', 'зауженной штаниной и фигурными вытачками на коленях', 'звуженою штаниною та фігурними виточками на колінах', 'zwężaną nogawką i profilowanymi zaszewkami na kolanach'),
        note: t('Soft rinse wash delivers immediate comfort.', 'Мягкая промывка дарит комфорт с первого дня.', 'М’яке прання дарує комфорт з першого дня.', 'Delikatne płukanie zapewnia komfort od pierwszego dnia.'),
        composition: t('80% cotton, 18% recycled cotton, 2% elastane', '80% хлопок, 18% переработанный хлопок, 2% эластан', '80% бавовна, 18% перероблена бавовна, 2% еластан', '80% bawełna, 18% bawełna z recyklingu, 2% elastan'),
        care: t('Cold wash, tumble dry low if needed.', 'Стирка в холодной воде, щадящая сушка при необходимости.', 'Прання в холодній воді, делікатне сушіння за потреби.', 'Prać w zimnej wodzie, suszyć delikatnie w razie potrzeby.'),
        genderOptions: ['men', 'unisex'],
        sizeSet: 'denim',
        minPrice: 1750,
        maxPrice: 2380,
        features: [
            {
                title: t('Leg shape', 'Форма штанин', 'Форма штанин', 'Kształt nogawki'),
                value: t('Relaxed thigh with modern taper', 'Свободное бедро с современным заужением', 'Вільне стегно з сучасним звуженням', 'Luźne udo z nowoczesnym zwężeniem'),
            },
            {
                title: t('Stretch', 'Эластичность', 'Еластичність', 'Elastyczność'),
                value: t('Comfort stretch denim', 'Стрейчевый деним', 'Стрейчевий денім', 'Rozciągliwy denim'),
            },
        ],
    },
    {
        key: 'denim-jacket',
        categoryId: 'denim',
        names: t('Heritage Denim Jacket', 'Винтажная джинсовка', 'Вінтажна джинсівка', 'Kurtka denimowa vintage'),
        detail: t('triple-stitched seams and metal hardware', 'тройными швами и металлической фурнитурой', 'потрійними швами та металевою фурнітурою', 'potrójnymi szwami i metalowymi okuciami'),
        note: t('Boxy fit layers easily over knitwear.', 'Прямой крой легко надевается поверх трикотажа.', 'Прямий крій легко вдягається поверх трикотажу.', 'Luźny krój łatwo układa się na dzianinie.'),
        composition: t('100% cotton denim', '100% хлопковый деним', '100% бавовняний денім', '100% denim bawełniany'),
        care: t('Spot clean between washes to preserve color.', 'Точечная чистка между стирками сохраняет цвет.', 'Точкове чищення між праннями зберігає колір.', 'Czyszczenie punktowe między praniami zachowuje kolor.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'outerwear',
        minPrice: 2150,
        maxPrice: 2750,
        features: [
            {
                title: t('Wash', 'Отделка', 'Оздоблення', 'Wykończenie'),
                value: t('Vintage mid-wash', 'Винтажный средний оттенок', 'Вінтажний середній відтінок', 'Średnie przecieranie vintage'),
            },
            {
                title: t('Pockets', 'Карманы', 'Кишені', 'Kieszenie'),
                value: t('Four utility pockets', 'Четыре функциональных кармана', 'Чотири функціональні кишені', 'Cztery użytkowe kieszenie'),
            },
        ],
    },
    {
        key: 'leather-sneaker',
        categoryId: 'footwear',
        names: t('Minimal Leather Sneaker', 'Минималистичные кожаные кеды', 'Мінімалістичні шкіряні кеди', 'Minimalistyczne skórzane sneakersy'),
        detail: t('cushioned footbed and stitched cupsole', 'амортизирующей стелькой и прошитой подошвой', 'амортизуючою устілкою та прошитою підошвою', 'amortyzowaną wkładką i przeszywaną podeszwą'),
        note: t('Neutral profile that elevates casual outfits.', 'Нейтральный профиль подчеркивает повседневные образы.', 'Нейтральний профіль підкреслює повсякденні образи.', 'Neutralny profil podnosi codzienne stylizacje.'),
        composition: t('Upper: 100% leather; Lining: 100% cotton; Sole: 100% rubber', 'Верх: 100% кожа; Подкладка: 100% хлопок; Подошва: 100% резина', 'Верх: 100% шкіра; Підкладка: 100% бавовна; Підошва: 100% гума', 'Cholewka: 100% skóra; Podszewka: 100% bawełna; Podeszwa: 100% guma'),
        care: t('Wipe with damp cloth, use leather conditioner monthly.', 'Протирать влажной тканью, использовать кондиционер для кожи ежемесячно.', 'Протирати вологою ганчіркою, використовувати кондиціонер для шкіри щомісяця.', 'Przecierać wilgotną szmatką, stosować odżywkę do skóry co miesiąc.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'footwear',
        minPrice: 2650,
        maxPrice: 3350,
        features: [
            {
                title: t('Outsole', 'Подошва', 'Підошва', 'Podeszwa'),
                value: t('Stitched natural rubber cupsole', 'Прошитая чашеобразная подошва из натуральной резины', 'Прошита чашоподібна підошва з натуральної гуми', 'Przeszywana podeszwa z naturalnej gumy'),
            },
            {
                title: t('Lining', 'Подкладка', 'Підкладка', 'Podszewka'),
                value: t('Breathable cotton twill', 'Дышащая хлопковая саржа', 'Дихаюча бавовняна саржа', 'Oddychająca bawełniana diagonal'),
            },
        ],
    },
    {
        key: 'chelsea-boot',
        categoryId: 'footwear',
        names: t('Heritage Chelsea Boot', 'Классические челси', 'Класичні челсі', 'Klasyczne sztyblety'),
        detail: t('elastic gussets and stacked heel', 'эластичными вставками и наборным каблуком', 'еластичними вставками та набірним підбором', 'elastycznymi wstawkami i warstwowym obcasem'),
        note: t('Polished finish transitions from office to weekend.', 'Полированный финиш подходит и для офиса, и для выходных.', 'Полірований фініш пасує і офісу, і вихідним.', 'Polerowane wykończenie sprawdzi się w pracy i po godzinach.'),
        composition: t('Upper: 100% calf leather; Lining: 100% leather; Sole: leather and rubber insert', 'Верх: 100% телячья кожа; Подкладка: 100% кожа; Подошва: кожа с резиновой вставкой', 'Верх: 100% теляча шкіра; Підкладка: 100% шкіра; Підошва: шкіра з гумовою вставкою', 'Cholewka: 100% skóra cielęca; Podszewka: 100% skóra; Podeszwa: skóra z gumową wstawką'),
        care: t('Brush after wear and apply wax regularly.', 'Расчесывать после носки и регулярно наносить воск.', 'Щітити після носіння та регулярно наносити віск.', 'Czyścić szczotką po noszeniu i regularnie woskować.'),
        genderOptions: ['men', 'women'],
        sizeSet: 'footwear',
        minPrice: 3250,
        maxPrice: 4150,
        features: [
            {
                title: t('Construction', 'Конструкция', 'Конструкція', 'Konstrukcja'),
                value: t('Goodyear welted sole', 'Прошивной рантовый метод', 'Прошивний рантовий метод', 'Ramowa konstrukcja Goodyear'),
            },
            {
                title: t('Heel height', 'Высота каблука', 'Висота підборів', 'Wysokość obcasa'),
                value: t('30 mm stacked heel', '30 мм наборный каблук', '30 мм набірний підбор', '30 mm warstwowy obcas'),
            },
        ],
    },
    {
        key: 'trail-runner',
        categoryId: 'footwear',
        names: t('Trail Runner', 'Трейловые кроссовки', 'Трейлові кросівки', 'Buty trailowe'),
        detail: t('multidirectional lugs and reflective trims', 'многовекторными шипами и светоотражающими вставками', 'багатовекторними шипами та світловідбивними вставками', 'wielokierunkowymi kołkami i odblaskowymi wstawkami'),
        note: t('Responsive cushioning keeps you agile on uneven paths.', 'Реактивная амортизация поддерживает на неровных тропах.', 'Реактивна амортизація підтримує на нерівних стежках.', 'Reaktywna amortyzacja wspiera na nierównych trasach.'),
        composition: t('Upper: recycled mesh and TPU overlays; Sole: EVA midsole, rubber outsole', 'Верх: переработанная сетка и TPU накладки; Подошва: EVA и резина', 'Верх: перероблена сітка та TPU накладки; Підошва: EVA і гума', 'Cholewka: recyklingowana siatka i nakładki TPU; Podeszwa: EVA i guma'),
        care: t('Remove insoles and air dry after runs.', 'Вынимать стельки и просушивать после пробежек.', 'Виймати устілки та просушувати після пробіжок.', 'Wyjmować wkładki i suszyć po biegach.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'footwear',
        minPrice: 2450,
        maxPrice: 3120,
        features: [
            {
                title: t('Grip', 'Сцепление', 'Зчеплення', 'Przyczepność'),
                value: t('5 mm multidirectional lugs', '5 мм разнонаправленные шипы', '5 мм різноспрямовані шипи', '5 mm wielokierunkowe kołki'),
            },
            {
                title: t('Drop', 'Перепад', 'Перепад', 'Drop'),
                value: t('8 mm energetic drop', 'Перепад 8 мм для динамики', 'Перепад 8 мм для динаміки', 'Spadek 8 mm dla dynamiki'),
            },
        ],
    },
    {
        key: 'leather-belt',
        categoryId: 'accessories',
        names: t('Vegetable-Tanned Belt', 'Ремень растительного дубления', 'Пояс рослинного дублення', 'Pasek garbowany roślinnie'),
        detail: t('polished buckle and painted edges', 'полированной пряжкой и окрашенными кромками', 'полірованою пряжкою та пофарбованими краями', 'polerowaną klamrą i malowanymi krawędziami'),
        note: t('Develops a rich patina with every wear.', 'С каждым использованием приобретает благородную патину.', 'З кожним носінням набуває благородної патини.', 'Z każdym użyciem nabiera szlachetnej patyny.'),
        composition: t('100% vegetable-tanned leather', '100% кожа растительного дубления', '100% шкіра рослинного дублення', '100% skóra garbowana roślinnie'),
        care: t('Condition with neutral cream twice a year.', 'Обрабатывать нейтральным кремом два раза в год.', 'Обробляти нейтральним кремом двічі на рік.', 'Pielęgnować neutralnym kremem dwa razy w roku.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'accessories',
        minPrice: 950,
        maxPrice: 1250,
        features: [
            {
                title: t('Width', 'Ширина', 'Ширина', 'Szerokość'),
                value: t('3 cm versatile width', 'Ширина 3 см, универсальная', 'Ширина 3 см, універсальна', 'Szerokość 3 cm, uniwersalna'),
            },
            {
                title: t('Buckle finish', 'Отделка пряжки', 'Оздоблення пряжки', 'Wykończenie klamry'),
                value: t('Polished nickel-free metal', 'Полированный металл без никеля', 'Полірований метал без нікелю', 'Polerowany metal bez niklu'),
            },
        ],
    },
    {
        key: 'wool-scarf',
        categoryId: 'accessories',
        names: t('Reversible Wool Scarf', 'Двусторонний шерстяной шарф', 'Двосторонній вовняний шарф', 'Dwustronny szal wełniany'),
        detail: t('contrasting sides and eyelash fringe', 'контрастными сторонами и бахромой', 'контрастними сторонами та бахромою', 'kontrastowymi stronami i frędzlami'),
        note: t('Lightweight twill adds warmth without bulk.', 'Легкая саржа согревает без лишнего объема.', 'Легка саржа зігріває без зайвого об’єму.', 'Lekka diagonal grzeje bez dodawania objętości.'),
        composition: t('90% wool, 10% cashmere', '90% шерсть, 10% кашемир', '90% вовна, 10% кашемір', '90% wełna, 10% kaszmir'),
        care: t('Dry clean or hand wash cool and reshape.', 'Химчистка или ручная стирка в прохладной воде с восстановлением формы.', 'Хімчистка або ручне прання в прохолодній воді з відновленням форми.', 'Czyścić chemicznie lub prać ręcznie w chłodnej wodzie i uformować.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'accessories',
        minPrice: 1150,
        maxPrice: 1650,
        features: [
            {
                title: t('Dimensions', 'Размеры', 'Розміри', 'Wymiary'),
                value: t('180 × 35 cm', '180 × 35 см', '180 × 35 см', '180 × 35 cm'),
            },
            {
                title: t('Edge finish', 'Края', 'Краї', 'Wykończenie krawędzi'),
                value: t('Hand-twisted fringe', 'Ручная скрученая бахрома', 'Ручна скручена бахрома', 'Ręcznie skręcane frędzle'),
            },
        ],
    },
    {
        key: 'canvas-backpack',
        categoryId: 'accessories',
        names: t('Waxed Canvas Backpack', 'Рюкзак из вощеного канваса', 'Рюкзак з вощеного канвасу', 'Plecak z woskowanego płótna'),
        detail: t('roll-top closure and laptop sleeve', 'скручиваемым верхом и отсеком для ноутбука', 'скручуваним верхом і відділенням для ноутбука', 'z rolowanym zamknięciem i kieszenią na laptop'),
        note: t('Weather-resistant wax keeps gear dry on commutes.', 'Вощение защищает от непогоды в городе.', 'Вощення захищає від негоди в місті.', 'Woskowana powłoka chroni przed pogodą w mieście.'),
        composition: t('100% organic cotton canvas with recycled leather trim', '100% органический хлопковый канвас с отделкой из переработанной кожи', '100% органічний бавовняний канвас з оздобленням з переробленої шкіри', '100% organiczne płótno bawełniane z wykończeniem z recyklingowanej skóry'),
        care: t('Spot clean with damp cloth, re-wax seasonally.', 'Точечно очищать влажной тканью, обновлять воск по сезону.', 'Локально очищувати вологою ганчіркою, оновлювати віск за сезоном.', 'Czyścić miejscowo wilgotną ściereczką, sezonowo odświeżać wosk.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'accessories',
        minPrice: 1850,
        maxPrice: 2450,
        features: [
            {
                title: t('Capacity', 'Объем', 'Об’єм', 'Pojemność'),
                value: t('22 liters expandable', '22 литра с возможностью расширения', '22 літри з можливістю розширення', '22 litry z możliwością powiększenia'),
            },
            {
                title: t('Closure', 'Застежка', 'Застібка', 'Zapięcie'),
                value: t('Roll-top with aluminum hook', 'Скручиваемый верх с алюминиевым крючком', 'Скручуваний верх з алюмінієвим гачком', 'Zwijany top z aluminiowym hakiem'),
            },
        ],
    },
    {
        key: 'performance-legging',
        categoryId: 'sportswear',
        names: t('Performance Legging', 'Спортивные леггинсы', 'Спортивні легінси', 'Legginsy sportowe'),
        detail: t('four-way stretch and bonded pockets', 'четырехсторонней растяжимостью и склеенными карманами', 'чотиристоронньою розтяжністю та проклеєними кишенями', 'czterokierunkową elastycznością i klejonymi kieszeniami'),
        note: t('Quick-dry yarns keep you focused during intense sessions.', 'Быстросохнущие волокна удерживают комфорт во время тренировок.', 'Швидковисихаючі волокна тримають комфорт під час тренувань.', 'Szybkoschnące włókna utrzymują komfort w trakcie treningu.'),
        composition: t('68% recycled nylon, 32% elastane', '68% переработанный нейлон, 32% эластан', '68% перероблений нейлон, 32% еластан', '68% nylon z recyklingu, 32% elastan'),
        care: t('Machine wash cold with like colors, do not use fabric softener.', 'Стирать в холодной воде с подобными цветами, без кондиционера.', 'Прати в холодній воді з подібними кольорами, без кондиціонера.', 'Prać w zimnej wodzie z podobnymi kolorami, bez płynu zmiękczającego.'),
        genderOptions: ['women'],
        sizeSet: 'sportswear',
        minPrice: 1350,
        maxPrice: 1780,
        features: [
            {
                title: t('Compression', 'Компрессия', 'Компресія', 'Kompresja'),
                value: t('Medium support', 'Средняя поддержка', 'Середня підтримка', 'Średnie podparcie'),
            },
            {
                title: t('Pocket', 'Карман', 'Кишеня', 'Kieszeń'),
                value: t('Bonded back phone pocket', 'Склеенный задний карман для телефона', 'Проклеєна задня кишеня для телефону', 'Klejona tylna kieszeń na telefon'),
            },
        ],
    },
    {
        key: 'training-hoodie',
        categoryId: 'sportswear',
        names: t('Training Hoodie', 'Тренировочное худи', 'Тренувальне худі', 'Bluza treningowa'),
        detail: t('thermal panels and thumb loops', 'тепловыми вставками и петлями для больших пальцев', 'тепловими вставками та петлями для великих пальців', 'panelami termicznymi i pętlami na kciuki'),
        note: t('Interior grid fleece manages heat during warmups.', 'Внутренний вафельный флис управляет теплом на разминке.', 'Внутрішній вафельний фліс керує теплом під час розминки.', 'Wewnętrzny polar w strukturze siatki reguluje ciepło na rozgrzewce.'),
        composition: t('Body: 92% recycled polyester, 8% elastane', 'Основная ткань: 92% переработанный полиэстер, 8% эластан', 'Основна тканина: 92% перероблений поліестер, 8% еластан', 'Materiał główny: 92% poliester z recyklingu, 8% elastan'),
        care: t('Machine wash cold, tumble dry low.', 'Стирать в холодной воде, сушить при низкой температуре.', 'Прати в холодній воді, сушити при низькій температурі.', 'Prać w zimnej wodzie, suszyć w niskiej temperaturze.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'sportswear',
        minPrice: 1450,
        maxPrice: 1980,
        features: [
            {
                title: t('Fabric weight', 'Плотность ткани', 'Щільність тканини', 'Gramatura'),
                value: t('260 gsm technical fleece', '260 г/м² технический флис', '260 г/м² технічний фліс', '260 g/m² techniczny polar'),
            },
            {
                title: t('Reflectivity', 'Светоотражение', 'Світловідбиття', 'Elementy odblaskowe'),
                value: t('Reflective chest logo', 'Светоотражающий логотип на груди', 'Світловідбивний логотип на грудях', 'Odblaskowe logo na piersi'),
            },
        ],
    },
    {
        key: 'running-short',
        categoryId: 'sportswear',
        names: t('Running Short', 'Беговые шорты', 'Бігові шорти', 'Szorty biegowe'),
        detail: t('laser-cut hems and brief liner', 'лазерными краями и встроенными трусами', 'лазерними краями та вбудованими трусами', 'laserowo ciętymi brzegami i wszytą podszewką'),
        note: t('Featherweight fabric moves effortlessly with you.', 'Невесомая ткань движется вслед за вами.', 'Невагома тканина рухається разом з вами.', 'Ultralekki materiał porusza się wraz z Tobą.'),
        composition: t('86% recycled polyester, 14% elastane', '86% переработанный полиэстер, 14% эластан', '86% перероблений поліестер, 14% еластан', '86% poliester z recyklingu, 14% elastan'),
        care: t('Machine wash cold, hang to dry.', 'Стирать в холодной воде, сушить на вешалке.', 'Прати в холодній воді, сушити на вішаку.', 'Prać w zimnej wodzie, suszyć na wieszaku.'),
        genderOptions: ['men', 'women', 'unisex'],
        sizeSet: 'sportswear',
        minPrice: 950,
        maxPrice: 1280,
        features: [
            {
                title: t('Inseam', 'Длина по внутреннему шву', 'Довжина крокового шва', 'Długość nogawki'),
                value: t('12 cm versatile inseam', '12 см универсальная длина', '12 см універсальна довжина', '12 cm uniwersalna długość'),
            },
            {
                title: t('Storage', 'Хранение', 'Зберігання', 'Przechowywanie'),
                value: t('Rear zip pocket for keys', 'Задний карман на молнии для ключей', 'Задня кишеня на блискавці для ключів', 'Tylna kieszonka na zamek na klucze'),
            },
        ],
    },
    {
        key: 'linen-midi-dress',
        categoryId: 'dresses',
        names: t('Linen Midi Dress', 'Льняное миди-платье', 'Лляна сукня міді', 'Lniana sukienka midi'),
        detail: t('removable belt and side vents', 'съемным поясом и боковыми разрезами', 'знімним поясом і боковими розрізами', 'odpinanym paskiem i bocznymi rozcięciami'),
        note: t('Textured weave keeps airflow on warm days.', 'Фактурное плетение обеспечивает воздушность в жару.', 'Фактурне плетіння забезпечує легкість у спеку.', 'Strukturalny splot zapewnia przewiewność w upały.'),
        composition: t('100% European flax linen', '100% лен европейского льна', '100% льон європейського льону', '100% len z europejskiego lnu'),
        care: t('Machine wash cold, hang dry and steam lightly.', 'Стирать в холодной воде, сушить на вешалке и отпаривать.', 'Прати в холодній воді, сушити на вішаку та злегка відпарювати.', 'Prać w zimnej wodzie, suszyć na wieszaku i delikatnie parować.'),
        genderOptions: ['women'],
        sizeSet: 'dresses',
        minPrice: 2050,
        maxPrice: 2680,
        features: [
            {
                title: t('Neckline', 'Вырез', 'Виріз', 'Dekolt'),
                value: t('Notched v-neck', 'Фигурный V-образный вырез', 'Фігурний V-подібний виріз', 'Wcięty dekolt w kształcie V'),
            },
            {
                title: t('Skirt', 'Юбка', 'Спідниця', 'Dół sukienki'),
                value: t('A-line midi length', 'А-силуэт до середины голени', 'А-силует до середини гомілки', 'Rozkloszowany fason do połowy łydki'),
            },
        ],
    },
    {
        key: 'wrap-dress',
        categoryId: 'dresses',
        names: t('Silk Wrap Dress', 'Шелковое платье-запах', 'Шовкова сукня на запах', 'Jedwabna sukienka kopertowa'),
        detail: t('fluid wrap front and waist tie', 'плавной полочкой на запах и поясом', 'плавною поличкою на запах і поясом', 'swobodną kopertą i wiązaniem w talii'),
        note: t('Matte silk drapes with elegant movement.', 'Матовый шелк красиво драпируется при движении.', 'Матовий шовк красиво драпірується під час руху.', 'Matowy jedwab elegancko układa się w ruchu.'),
        composition: t('100% sandwashed silk', '100% шелк с песочной обработкой', '100% шовк із пісковою обробкою', '100% jedwab przecierany'),
        care: t('Dry clean or hand wash cold with silk detergent.', 'Химчистка или ручная стирка в холодной воде с деликатным средством.', 'Хімчистка або ручне прання в холодній воді зі спеціальним засобом.', 'Czyścić chemicznie lub prać ręcznie w zimnej wodzie z delikatnym środkiem.'),
        genderOptions: ['women'],
        sizeSet: 'dresses',
        minPrice: 2950,
        maxPrice: 3780,
        features: [
            {
                title: t('Sleeve', 'Рукав', 'Рукав', 'Rękaw'),
                value: t('Bracelet-length sleeves', 'Рукава длиной до запястья', 'Рукава завдовжки до зап’ястя', 'Rękawy do nadgarstków'),
            },
            {
                title: t('Closure', 'Застежка', 'Застібка', 'Zapięcie'),
                value: t('Adjustable wrap tie', 'Регулируемый пояс-завязка', 'Регульований пояс-зав’язка', 'Regulowane wiązanie'),
            },
        ],
    },
    {
        key: 'pleated-shirt-dress',
        categoryId: 'dresses',
        names: t('Pleated Shirt Dress', 'Плиссированное платье-рубашка', 'Плісирована сукня-сорочка', 'Plisowana sukienka koszulowa'),
        detail: t('knife pleats and hidden placket', 'одинарными складками и потайной планкой', 'гострими складками і потайною планкою', 'plisami i ukrytym zapięciem'),
        note: t('Crisp cotton poplin keeps structure through the day.', 'Хлопковый поплин сохраняет форму в течение дня.', 'Бавовняний поплін зберігає форму впродовж дня.', 'Bawełniany popelin zachowuje formę przez cały dzień.'),
        composition: t('96% cotton, 4% elastane', '96% хлопок, 4% эластан', '96% бавовна, 4% еластан', '96% bawełna, 4% elastan'),
        care: t('Machine wash cold, tumble dry low and press lightly.', 'Стирать в холодной воде, сушить при низкой температуре и слегка отпаривать.', 'Прати в холодній воді, сушити при низькій температурі та злегка відпарювати.', 'Prać w zimnej wodzie, suszyć w niskiej temperaturze i lekko prasować.'),
        genderOptions: ['women'],
        sizeSet: 'dresses',
        minPrice: 2350,
        maxPrice: 2980,
        features: [
            {
                title: t('Buttons', 'Пуговицы', 'Гудзики', 'Guziki'),
                value: t('Mother-of-pearl buttons', 'Перламутровые пуговицы', 'Перламутрові гудзики', 'Guziki z masy perłowej'),
            },
            {
                title: t('Pleats', 'Складки', 'Складки', 'Plisy'),
                value: t('Permanent press pleating', 'Фиксированные складки', 'Фіксовані складки', 'Trwałe plisy'),
            },
        ],
    },
    {
        key: 'slim-blazer',
        categoryId: 'tailoring',
        names: t('Slim Wool Blazer', 'Приталенный шерстяной пиджак', 'Приталений вовняний піджак', 'Taliowana marynarka z wełny'),
        detail: t('soft shoulder and notch lapel', 'мягким плечом и лацканом с вырезом', 'м’яким плечем і лацканом з вирізом', 'miękką linią ramion i klapami notch'),
        note: t('Half-canvassed construction offers structure with movement.', 'Полукаркасная конструкция держит форму и дает свободу движения.', 'Напівкаркасна конструкція тримає форму і дає свободу руху.', 'Półpłócienna konstrukcja łączy strukturę z wygodą ruchu.'),
        composition: t('Shell: 98% wool, 2% elastane; Lining: 100% viscose', 'Верх: 98% шерсть, 2% эластан; Подкладка: 100% вискоза', 'Верх: 98% вовна, 2% еластан; Підкладка: 100% віскоза', 'Wierzch: 98% wełna, 2% elastan; Podszewka: 100% wiskoza'),
        care: t('Dry clean only, press with low steam.', 'Только химчистка, отпаривание на низком режиме.', 'Тільки хімчистка, відпарювання на низькому режимі.', 'Czyścić chemicznie, prasować parą na niskiej temperaturze.'),
        genderOptions: ['men', 'women'],
        sizeSet: 'tailoring',
        minPrice: 3550,
        maxPrice: 4680,
        features: [
            {
                title: t('Lining', 'Подкладка', 'Підкладка', 'Podszewka'),
                value: t('Breathable viscose panels', 'Дышащая вискозная подкладка', 'Дихаюча віскозна підкладка', 'Oddychające panele z wiskozy'),
            },
            {
                title: t('Pockets', 'Карманы', 'Кишені', 'Kieszenie'),
                value: t('Functional ticket pocket', 'Функциональный билетный карман', 'Функціональна квиткова кишеня', 'Funkcjonalna kieszonka biletowa'),
            },
        ],
    },
    {
        key: 'wool-trousers',
        categoryId: 'tailoring',
        names: t('Tapered Wool Trousers', 'Зауженные шерстяные брюки', 'Завужені вовняні брюки', 'Zwężane spodnie wełniane'),
        detail: t('front pleats and cuffed hem', 'передними складками и подворотом по низу', 'передніми складками та підворотом внизу', 'zakładkami z przodu i mankietami u dołu'),
        note: t('Crease-resistant wool keeps a sharp profile from desk to dinner.', 'Несминаемая шерсть сохраняет четкую линию с утра до вечера.', 'Несминаюча вовна зберігає чітку лінію від ранку до вечора.', 'Wełna odporna на zagniecenia utrzymuje schludną linię przez cały dzień.'),
        composition: t('96% wool, 4% elastane', '96% шерсть, 4% эластан', '96% вовна, 4% еластан', '96% wełna, 4% elastan'),
        care: t('Dry clean, hang from cuffs to maintain crease.', 'Химчистка, сушить на тремпеле за подвороты для сохранения стрелки.', 'Хімчистка, сушити на тремпелі за манжети, щоб зберегти стрілку.', 'Czyścić chemicznie, suszyć na klipsach przy mankietach.'),
        genderOptions: ['men', 'women'],
        sizeSet: 'tailoring',
        minPrice: 2450,
        maxPrice: 3250,
        features: [
            {
                title: t('Waistband', 'Пояс', 'Пояс', 'Pas'),
                value: t('Curtain waistband with grip tape', 'Пояс с противоскользящей лентой', 'Пояс із протиковзною стрічкою', 'Pas z taśmą antypoślizgową'),
            },
            {
                title: t('Lining', 'Подкладка', 'Підкладка', 'Podszewka'),
                value: t('Knee-to-knee lining', 'Подкладка до колена', 'Підкладка до коліна', 'Podszycie do wysokości kolan'),
            },
        ],
    },
    {
        key: 'vest-set',
        categoryId: 'tailoring',
        names: t('Three-Piece Vest Set', 'Тройка с жилетом', 'Трійка з жилетом', 'Trzyczęściowy zestaw z kamizelką'),
        detail: t('adjustable back and notch lapels', 'регулируемой спинкой и лацканами с вырезом', 'регульованою спинкою і лацканами з вирізом', 'regulowanym tyłem i klapami notch'),
        note: t('Coordinated pieces layer together or style separately.', 'Согласованные элементы можно носить вместе или отдельно.', 'Поєднані елементи можна носити разом або окремо.', 'Dopasowane elementy można nosić razem lub osobno.'),
        composition: t('Shell: 54% recycled polyester, 44% wool, 2% elastane; Lining: 55% polyester, 45% viscose', 'Верх: 54% переработанный полиэстер, 44% шерсть, 2% эластан; Подкладка: 55% полиэстер, 45% вискоза', 'Верх: 54% перероблений поліестер, 44% вовна, 2% еластан; Підкладка: 55% поліестер, 45% віскоза', 'Wierzch: 54% poliester z recyklingu, 44% wełna, 2% elastan; Podszewka: 55% poliester, 45% wiskoza'),
        care: t('Dry clean, store on padded hanger to retain shape.', 'Химчистка, хранить на мягких плечиках для сохранения формы.', 'Хімчистка, зберігати на м’яких плечиках для збереження форми.', 'Czyścić chemicznie, przechowywać na wyściełanych wieszakach.'),
        genderOptions: ['men', 'unisex'],
        sizeSet: 'tailoring',
        minPrice: 4150,
        maxPrice: 5250,
        features: [
            {
                title: t('Buttons', 'Пуговицы', 'Гудзики', 'Guziki'),
                value: t('Horn-effect buttons', 'Пуговицы под рог', 'Ґудзики під ріг', 'Guziki imitujące róg'),
            },
            {
                title: t('Vest back', 'Спинка жилета', 'Спинка жилета', 'Tył kamizelki'),
                value: t('Satin back with adjuster', 'Атласная спинка с регулятором', 'Атласна спинка з регулятором', 'Satynowy tył z regulacją'),
            },
        ],
    },
];

const colorFeatureTitle = t('Color', 'Цвет', 'Колір', 'Kolor');
const brandFeatureTitle = t('Brand', 'Бренд', 'Бренд', 'Marka');

const shuffle = (array) => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const randomInt = (min, max) => {
    const lower = Math.ceil(min);
    const upper = Math.floor(max);
    return Math.floor(Math.random() * (upper - lower + 1)) + lower;
};

const randomPrice = (min, max) => {
    const base = randomInt(min, max);
    return Math.round(base / 10) * 10;
};

const formatCurrency = (value) => `${value.toLocaleString('uk-UA')} ₴`;

const buildFeatures = (styleFeatures, colorOption, brand) => {
    const baseFeatures = styleFeatures.map((feature) => ({
        title: feature.title.en,
        value: feature.value.en,
        title_translations: feature.title,
        value_translations: feature.value,
    }));

    baseFeatures.push({
        title: colorFeatureTitle.en,
        value: colorOption.translations.en,
        title_translations: colorFeatureTitle,
        value_translations: colorOption.translations,
    });

    baseFeatures.push({
        title: brandFeatureTitle.en,
        value: brand,
        title_translations: brandFeatureTitle,
        value_translations: {
            en: brand,
            ru: brand,
            uk: brand,
            pl: brand,
        },
    });

    return baseFeatures;
};

const generateProducts = () => {
    const products = [];
    let productIndex = 1;

    for (const style of styles) {
        const colorChoices = shuffle(colors).slice(0, 3);
        const brandChoices = shuffle(brands).slice(0, 3);

        colorChoices.forEach((colorOption, idx) => {
            const brandName = brandChoices[idx % brandChoices.length];
            const gender = style.genderOptions[idx % style.genderOptions.length];
            const price = randomPrice(style.minPrice, style.maxPrice);
            const id = `prod-${String(productIndex).padStart(3, '0')}`;
            const article = String(100000 + productIndex);
            const imagePath = `images/products/${style.categoryId}/${id}.jpg`;
            const imageUrls = [
                imagePath,
                imagePath.replace('.jpg', '_detail.jpg'),
                imagePath.replace('.jpg', '_look.jpg'),
            ];
            const sizes = sizeSets[style.sizeSet] || ['One Size'];

            const nameTranslations = {};
            const descriptionTranslations = {};

            for (const lang of languages) {
                const colorName = colorOption.translations[lang];
                const styleName = style.names[lang];
                const detailText = style.detail[lang];
                const noteText = style.note[lang];
                const template = descriptionTemplate[lang];
                const description = `${template
                    .replace('{brand}', brandName)
                    .replace('{styleName}', styleName)
                    .replace('{color}', colorName.toLowerCase())
                    .replace('{detail}', detailText)} ${noteText}`.trim();

                descriptionTranslations[lang] = description;
                nameTranslations[lang] = `${brandName} ${colorName} ${styleName}`;
            }

            products.push({
                id,
                article,
                category_id: style.categoryId,
                image_path: imagePath,
                image_urls: imageUrls,
                name: nameTranslations.en,
                price,
                price_string: formatCurrency(price),
                description: descriptionTranslations.en,
                is_bestseller: productIndex % 5 === 0,
                gender,
                brand: brandName,
                color: colorOption.translations.en,
                sizes,
                composition: style.composition.en,
                care_instructions: style.care.en,
                features: buildFeatures(style.features, colorOption, brandName),
                reviews: [],
                name_translations: nameTranslations,
                description_translations: descriptionTranslations,
                composition_translations: style.composition,
                care_instructions_translations: style.care,
            });

            productIndex += 1;
        });
    }

    return products;
};

async function setupDatabase() {
    let client;
    try {
        console.log('🔗 Attempting to connect to PostgreSQL database...');
        client = await pool.connect();
        console.log('✅ Database connection established successfully!');

        await client.query('BEGIN');
        console.log('⚙️ Executing database setup script...');
        await client.query(setupQuery);
        console.log('🧱 Schema created. Inserting seed data...');

        const insertCategoryQuery = `
            INSERT INTO categories (id, name, slug, parent_id, image_path, icon_path, name_translations)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        for (const category of categories) {
            await client.query(insertCategoryQuery, [
                category.id,
                category.name,
                category.slug,
                category.parent_id,
                category.image_path,
                category.icon_path,
                JSON.stringify(category.name_translations),
            ]);
        }

        const products = generateProducts();

        const insertProductQuery = `
            INSERT INTO products (
                id,
                article,
                category_id,
                image_path,
                image_urls,
                name,
                price,
                price_string,
                description,
                is_bestseller,
                gender,
                brand,
                color,
                sizes,
                composition,
                care_instructions,
                features,
                reviews,
                name_translations,
                description_translations,
                composition_translations,
                care_instructions_translations
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
            )
        `;

        for (const product of products) {
            await client.query(insertProductQuery, [
                product.id,
                product.article,
                product.category_id,
                product.image_path,
                JSON.stringify(product.image_urls),
                product.name,
                product.price,
                product.price_string,
                product.description,
                product.is_bestseller,
                product.gender,
                product.brand,
                product.color,
                JSON.stringify(product.sizes),
                product.composition,
                product.care_instructions,
                JSON.stringify(product.features),
                JSON.stringify(product.reviews),
                JSON.stringify(product.name_translations),
                JSON.stringify(product.description_translations),
                JSON.stringify(product.composition_translations),
                JSON.stringify(product.care_instructions_translations),
            ]);
        }

        await client.query('COMMIT');
        console.log(`🗂️ Inserted ${categories.length} categories.`);
        console.log(`🛍️ Inserted ${products.length} products with localized content.`);
    } catch (err) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('❌ Database setup failed:', err.message);
        if (err.detail) {
            console.error('ℹ️  Detail:', err.detail);
        }
        if (err.hint) {
            console.error('💡 Hint:', err.hint);
        }
    } finally {
        if (client) {
            client.release();
            console.log('🔌 Database connection closed.');
        }
        await pool.end();
    }
}

setupDatabase();
