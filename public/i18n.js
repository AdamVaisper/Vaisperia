/**
 * VAISPERIA Safe i18n Module (RU, UZ, EN)
 */

(function () {
    const translations = {
        ru: {
            app_title: "Vaisperia",
            bio_subtitle: "Обязательный биометрический контроль гражданина",
            label_username: "Никнейм гражданина",
            placeholder_username: "Введите ваш никнейм",
            label_email: "Электронная почта (Gmail)",
            placeholder_email: "example@gmail.com",
            label_password: "Пароль доступа",
            btn_forgot_password: "Забыли пароль?",
            btn_next_bio: "Далее: Сканирование лица ➔",
            btn_guest_login: "👤 Продолжить как гость",
            bio_step2_hint: "Разместите лицо по центру каучуковой рамки для уникальной биометрической идентификации.",
            btn_back: "↩ Назад",
            btn_submit_bio: "Пройти биометрию 🗸",
            
            nav_home: "Главная",
            nav_map: "Карта",
            nav_report: "Добавить",
            nav_shop: "Магазин",
            nav_profile: "Профиль",
            
            welcome_greeting: "Рады видеть вас,",
            default_citizen: "Гражданин",
            guest_user: "Гость",
            points_title: "Баланс эко-коинов",
            your_contribution: "Ваш вклад в город",
            current_rank_label: "Текущий ранг:",
            rank_eco_patrol: "Эко-патруль",
            how_to_earn_title: "Как заработать баллы?",
            earn_card1_title: "Сообщите о проблеме",
            earn_card1_desc: "Сфотографируйте свалку, сломанный фонарь или засуху на улице Нукуса.",
            earn_card2_title: "Получите +50 баллов",
            earn_card2_desc: "Каждая подтвержденная заявка приносит эко-коины на ваш игровой счет в приложении.",
            earn_card3_title: "Обменяйте в магазине",
            earn_card3_desc: "Покупайте стильные аксессуары, эко-сувениры или получайте скидки у партнеров Vaisperia!",
            
            // Map UI Elements
            map_statistics: "Статистика",
            map_hotspots: "🔥 Зоны скопления",
            map_filter_all: "Все",
            map_filter_new: "Новые",
            map_filter_in_progress: "В работе",
            map_filter_resolved: "Решенные",
            stat_city_title: "Статистика города",

            report_title: "Сообщить о городской проблеме",
            ux_hint_label: "Полезный совет:",
            ux_hint_text: "Чем точнее фотография и геолокация, тем быстрее организация сможет решить проблему.",
            month_progress_title: "Прогресс за месяц",
            month_progress_goal: "Цель: 10 отчетов для бонуса",
            month_progress_units: "отчетов",
            cat_label: "Категория проблемы",
            cat_roads: "Дороги",
            cat_water: "Вода",
            cat_electricity: "Элек-тво",
            cat_gas: "Газ",
            cat_fire: "Пожар",
            cat_accident: "ДТП",
            cat_hazard: "Опасн. в-ва",
            cat_garbage: "Мусор",
            cat_buildings: "Здания",
            cat_other: "Другое",
            photo_label: "Фотография проблемы (До 5МБ)",
            photo_dummy: "Сделать снимок на месте",
            desc_label: "Описание проблемы",
            desc_placeholder: "Детально опишите проблему (например: открытый люк, куча мусора за домом, поломка освещения...)",
            location_label: "Координаты местоположения",
            lat_placeholder: "Широта",
            lng_placeholder: "Долгота",
            loc_loading: "Загрузка геолокации...",
            loc_hint: "Вы также можете установить маркер, просто кликнув по нужному месту на вкладке «Карта».",
            anon_checkbox: "🔒 Опубликовать анонимно",
            anon_hint: "Ваше имя будет скрыто на карте (\"Анонимный гражданин\"), но баллы и XP зачислятся в ваш профиль.",
            btn_submit_report: "Отправить отчет",
            
            shop_title: "Магазин эко-наград",
            shop_subtitle: "Меняйте накопленные эко-коины на классные бонусы",
            coupon_10: "Купон: Скидка 10%",
            coupon_10_desc: "Скидка 10% на любые чеки до 50 000 сум у партнеров.",
            coupon_25: "Купон: Скидка 25%",
            coupon_25_desc: "Скидка 25% на любые чеки до 50 000 сум у партнеров.",
            coupon_50: "Купон: Скидка 50%",
            coupon_50_desc: "Скидка 50% на любые чеки до 50 000 сум у партнеров.",
            btn_get_reward: "Получить",
            btn_not_enough_coins: "Мало баллов",
            
            profile_coins: "Коинов",
            profile_reports: "Заявок",
            profile_level: "Уровень",
            achievements_header: "Ваши эко-достижения",
            ach_first_step_title: "Первый росток",
            ach_first_step_desc: "Успешно отправлен первый отчет",
            ach_patrol_title: "Защитник Нукуса",
            ach_patrol_desc: "Зарегистрировано более 3 отчетов",
            ach_hero_title: "Зеленый герой",
            ach_hero_desc: "Зарегистрировано более 5 отчетов",
            history_header: "История ваших сообщений",
            history_loading: "Загрузка истории обращений...",
            history_guest_placeholder: "Вы вошли как Гость. Зарегистрируйтесь, чтобы копить баллы и видеть историю!",
            history_empty_placeholder: "Вы пока не отправляли заявок. Вкладка \"Карта\" ждет вас!",
            
            settings_title: "Настройки ⚙️",
            change_avatar: "📸 Изменить фото профиля",
            avatar_hint: "Загрузите из галереи (до 5 МБ, проверяется фильтрами безопасности)",
            label_setting_username: "Имя пользователя (никнейм)",
            placeholder_setting_username: "Введите ваш ник",
            btn_save: "Сохранить",
            label_setting_email: "Электронная почта (Gmail)",
            btn_change: "Изменить",
            email_hint: "Требуется подтверждение биометрией или паролем",
            app_language: "Язык приложения",
            auto_geo_title: "Авто-геолокация",
            auto_geo_desc: "Автоматически определять координаты при открытии отчета",
            push_title: "Push-уведомления",
            push_desc: "Оповещать об изменениях статусов ваших отчетов",
            clear_cache: "🗑️ Очистить историю и кэш приложения",
            logout_profile: "Выйти из аккаунта ↩",
            
            status_new: "Новая",
            status_in_progress: "В обработке",
            status_resolved: "Решена"
        },
        uz: {
            app_title: "Vaisperia",
            bio_subtitle: "Fuqaroning majburiy biometrik nazorati",
            label_username: "Fuqaro laqabi (Username)",
            placeholder_username: "Laqabingizni kiriting",
            label_email: "Elektron pochta (Gmail)",
            placeholder_email: "example@gmail.com",
            label_password: "Kirish paroli",
            btn_forgot_password: "Parolni unutdingizmi?",
            btn_next_bio: "Keyingisi: Yuzni skanerlash ➔",
            btn_guest_login: "👤 Mehmon sifatida davom etish",
            bio_step2_hint: "Yuzingizni noyob biometrik identifikatsiya qilish uchun ramka markaziga joylashtiring.",
            btn_back: "↩ Orqaga",
            btn_submit_bio: "Biometriyadan o'tish 🗸",
            
            nav_home: "Bosh sahifa",
            nav_map: "Xarita",
            nav_report: "Qo'shish",
            nav_shop: "Do'kon",
            nav_profile: "Profil",
            
            welcome_greeting: "Xush ko'rdik,",
            default_citizen: "Fuqaro",
            guest_user: "Mehmon",
            points_title: "Eko-koinlar balansi",
            your_contribution: "Sizning shaharga qo'shgan hissangiz",
            current_rank_label: "Hozirgi daraja:",
            rank_eco_patrol: "Eko-patrul",
            how_to_earn_title: "Qanday qilib ball to'plash mumkin?",
            earn_card1_title: "Muammo haqida xabar bering",
            earn_card1_desc: "Nukus ko'chalaridagi axlatxona, singan chiroq yoki qurib qolgan daraxtni suratga oling.",
            earn_card2_title: "+50 ball o'ling",
            earn_card2_desc: "Har bir tasdiqlangan ariza ilovadagi hisobingizga eko-koinlar olib keladi.",
            earn_card3_title: "Do'konda almashtiring",
            earn_card3_desc: "Zamonaviy aksessuarlar, eko-suvenirlar sotib oling yoki Vaisperia hamkorlaridan chegirmalar oling!",
            
            map_statistics: "Statistika",
            map_hotspots: "🔥 Gavjum zonalar",
            map_filter_all: "Barchasi",
            map_filter_new: "Yangi",
            map_filter_in_progress: "Jarayonda",
            map_filter_resolved: "Hal qilingan",
            stat_city_title: "Shahar statistikasi",

            report_title: "Shahar muammosi haqida xabar berish",
            ux_hint_label: "Foydali maslahat:",
            ux_hint_text: "Fotosurat va geolokatsiya qanchalik aniq bo'lsa, tashkilot muammoni shunchalik tez hal qiladi.",
            month_progress_title: "Oylik taraqqiyot",
            month_progress_goal: "Maqsad: Bonus uchun 10 ta hisobot",
            month_progress_units: "hisobotlar",
            cat_label: "Muammo kategoriyasi",
            cat_roads: "Yo'llar",
            cat_water: "Suv",
            cat_electricity: "Elektr",
            cat_gas: "Gaz",
            cat_fire: "Yong'in",
            cat_accident: "YTH",
            cat_hazard: "Xavfli m.",
            cat_garbage: "Chiqindi",
            cat_buildings: "Binolar",
            cat_other: "Boshqa",
            photo_label: "Muammoning fotosurati (5MB gacha)",
            photo_dummy: "Joyida suratga olish",
            desc_label: "Muammo tavsifi",
            desc_placeholder: "Muammoni batafsil tasvirlab bering (masalan: ochiq lyuk, uy orqasidagi axlat, chiroq buzilishi...)",
            location_label: "Joylashuv koordinatalari",
            lat_placeholder: "Kenglik",
            lng_placeholder: "Uzunlik",
            loc_loading: "Geolokatsiya yuklanmoqda...",
            loc_hint: "Shuningdek, «Xarita» varag'ida kerakli joyni bosish orqali belgi qo'yishingiz mumkin.",
            anon_checkbox: "🔒 Anonim tarzda chop etish",
            anon_hint: "Ismingiz xaritada yashiriladi (\"Anonim fuqaro\"), ammo ballar va XP profilingizga beriladi.",
            btn_submit_report: "Hisobotni yuborish",
            
            shop_title: "Eko-mukofotlar do'koni",
            shop_subtitle: "To'plangan eko-koinlarni ajoyib bonuslarga almashtiring",
            coupon_10: "Kupon: 10% chegirma",
            coupon_10_desc: "Hamkorlarda 50 000 so'mgacha bo'lgan cheklarga 10% chegirma.",
            coupon_25: "Kupon: 25% chegirma",
            coupon_25_desc: "Hamkorlarda 50 000 so'mgacha bo'lgan cheklarga 25% chegirma.",
            coupon_50: "Kupon: 50% chegirma",
            coupon_50_desc: "Hamkorlarda 50 000 so'mgacha bo'lgan cheklarga 50% chegirma.",
            btn_get_reward: "Olish",
            btn_not_enough_coins: "Ball yetarli emas",
            
            profile_coins: "Koinlar",
            profile_reports: "Arizalar",
            profile_level: "Daraja",
            achievements_header: "Sizning eko-yutuqlaringiz",
            ach_first_step_title: "Birinchi nihol",
            ach_first_step_desc: "Birinchi hisobot muvaffaqiyatli yuborildi",
            ach_patrol_title: "Nukus himoyachisi",
            ach_patrol_desc: "3 ta dan ortiq hisobot ro'yxatdan o'tkazildi",
            ach_hero_title: "Yashil qahramon",
            ach_hero_desc: "5 ta dan ortiq hisobot ro'yxatdan o'tkazildi",
            history_header: "Xabarlaringiz tarixi",
            history_loading: "Murojaatlar tarixi yuklanmoqda...",
            history_guest_placeholder: "Siz Mehmon sifatida kirdingiz. Ball to'plash va tarixni ko'rish uchun ro'yxatdan o'ting!",
            history_empty_placeholder: "Siz hali arizalar yubormadingiz. \"Xarita\" bo'limi sizni kutmoqda!",
            
            settings_title: "Sozlamalar ⚙️",
            change_avatar: "📸 Profil rasmini o'zgartirish",
            avatar_hint: "Galereyadan yuklang (5 MB gacha, xavfsizlik filtrlari bilan tekshiriladi)",
            label_setting_username: "Foydalanuvchi ismi (laqab)",
            placeholder_setting_username: "Laqabingizni kiriting",
            btn_save: "Saqlash",
            label_setting_email: "Elektron pochta (Gmail)",
            btn_change: "O'zgartirish",
            email_hint: "Biometriya yoki parol bilan tasdiqlash talab etiladi",
            app_language: "Ilova tili",
            auto_geo_title: "Avto-geolokatsiya",
            auto_geo_desc: "Hisobot ochilganda koordinatalarni avtomatik aniqlash",
            push_title: "Push-bildirishnomalar",
            push_desc: "Hisobotlaringiz holati o'zgarishi haqida xabar berish",
            clear_cache: "🗑️ Tarix va keshni tozalash",
            logout_profile: "Hisobdan chiqish ↩",
            
            status_new: "Yangi",
            status_in_progress: "Ko'rib chiqilmoqda",
            status_resolved: "Hal etildi"
        },
        en: {
            app_title: "Vaisperia",
            bio_subtitle: "Mandatory citizen biometric control",
            label_username: "Citizen Username",
            placeholder_username: "Enter your username",
            label_email: "Email address (Gmail)",
            placeholder_email: "example@gmail.com",
            label_password: "Access password",
            btn_forgot_password: "Forgot password?",
            btn_next_bio: "Next: Face Scanning ➔",
            btn_guest_login: "👤 Continue as guest",
            bio_step2_hint: "Place your face in the center of the frame for biometric identification.",
            btn_back: "↩ Back",
            btn_submit_bio: "Complete Biometrics 🗸",
            
            nav_home: "Home",
            nav_map: "Map",
            nav_report: "Add",
            nav_shop: "Shop",
            nav_profile: "Profile",
            
            welcome_greeting: "Welcome back,",
            default_citizen: "Citizen",
            guest_user: "Guest",
            points_title: "Eco-coins balance",
            your_contribution: "Your contribution to the city",
            current_rank_label: "Current rank:",
            rank_eco_patrol: "Eco Patrol",
            how_to_earn_title: "How to earn points?",
            earn_card1_title: "Report a problem",
            earn_card1_desc: "Take a photo of garbage dumps, broken light posts, or drought in Nukus.",
            earn_card2_title: "Get +50 points",
            earn_card2_desc: "Each verified report earns eco-coins added to your application balance.",
            earn_card3_title: "Exchange in shop",
            earn_card3_desc: "Get stylish accessories, eco-souvenirs or discounts from Vaisperia partners!",
            
            map_statistics: "Statistics",
            map_hotspots: "🔥 Hotspots",
            map_filter_all: "All",
            map_filter_new: "New",
            map_filter_in_progress: "In Progress",
            map_filter_resolved: "Resolved",
            stat_city_title: "City Statistics",

            report_title: "Report a city problem",
            ux_hint_label: "Useful tip:",
            ux_hint_text: "The more accurate the photo and location, the faster the issue will be resolved.",
            month_progress_title: "Monthly progress",
            month_progress_goal: "Goal: 10 reports for bonus",
            month_progress_units: "reports",
            cat_label: "Problem category",
            cat_roads: "Roads",
            cat_water: "Water",
            cat_electricity: "Electric",
            cat_gas: "Gas",
            cat_fire: "Fire",
            cat_accident: "Accident",
            cat_hazard: "Hazardous",
            cat_garbage: "Garbage",
            cat_buildings: "Buildings",
            cat_other: "Other",
            photo_label: "Problem photo (Up to 5MB)",
            photo_dummy: "Take a photo on site",
            desc_label: "Problem description",
            desc_placeholder: "Describe the problem in detail (e.g. open manhole, garbage pile, light breakdown...)",
            location_label: "Location coordinates",
            lat_placeholder: "Latitude",
            lng_placeholder: "Longitude",
            loc_loading: "Loading geolocation...",
            loc_hint: "You can also set a marker by simply clicking on the desired spot on the 'Map' tab.",
            anon_checkbox: "🔒 Publish anonymously",
            anon_hint: "Your name will be hidden on map (\"Anonymous citizen\"), but points and XP go to your profile.",
            btn_submit_report: "Submit report",
            
            shop_title: "Eco-rewards shop",
            shop_subtitle: "Exchange accumulated eco-coins for cool bonuses",
            coupon_10: "Coupon: 10% Discount",
            coupon_10_desc: "10% off any receipt up to 50,000 UZS at partner stores.",
            coupon_25: "Coupon: 25% Discount",
            coupon_25_desc: "25% off any receipt up to 50,000 UZS at partner stores.",
            coupon_50: "Coupon: 50% Discount",
            coupon_50_desc: "50% off any receipt up to 50,000 UZS at partner stores.",
            btn_get_reward: "Get reward",
            btn_not_enough_coins: "Not enough points",
            
            profile_coins: "Coins",
            profile_reports: "Reports",
            profile_level: "Level",
            achievements_header: "Your eco achievements",
            ach_first_step_title: "First Sprout",
            ach_first_step_desc: "First report successfully submitted",
            ach_patrol_title: "Nukus Guardian",
            ach_patrol_desc: "More than 3 reports registered",
            ach_hero_title: "Green Hero",
            ach_hero_desc: "More than 5 reports registered",
            history_header: "Your report history",
            history_loading: "Loading report history...",
            history_guest_placeholder: "You are logged in as Guest. Register to earn points and view history!",
            history_empty_placeholder: "You haven't submitted any reports yet. The 'Map' tab is waiting for you!",
            
            settings_title: "Settings ⚙️",
            change_avatar: "📸 Change profile photo",
            avatar_hint: "Upload from gallery (up to 5 MB, verified with safety filters)",
            label_setting_username: "Username",
            placeholder_setting_username: "Enter your username",
            btn_save: "Save",
            label_setting_email: "Email (Gmail)",
            btn_change: "Change",
            email_hint: "Biometric or password confirmation required",
            app_language: "App Language",
            auto_geo_title: "Auto-geolocation",
            auto_geo_desc: "Automatically detect coordinates when opening report tab",
            push_title: "Push notifications",
            push_desc: "Notify about status changes of your reports",
            clear_cache: "🗑️ Clear history and app cache",
            logout_profile: "Log out ↩",
            
            status_new: "New",
            status_in_progress: "In Progress",
            status_resolved: "Resolved"
        }
    };

    const flags = {
        ru: { flag: "🇷🇺", code: "RU", name: "Русский" },
        uz: { flag: "🇺🇿", code: "UZ", name: "O'zbekcha" },
        en: { flag: "🇬🇧", code: "EN", name: "English" }
    };

    const listeners = [];

    function getSavedLanguage() {
        const lang = localStorage.getItem('app_lang') || localStorage.getItem('i18nextLng') || localStorage.getItem('user_language') || 'ru';
        return translations[lang] ? lang : 'ru';
    }

    let currentLang = getSavedLanguage();

    function t(key, fallback = "") {
        if (translations[currentLang] && translations[currentLang][key] !== undefined) {
            return translations[currentLang][key];
        }
        if (translations.ru && translations.ru[key] !== undefined) {
            return translations.ru[key];
        }
        return fallback || key;
    }

    function setLanguage(lang) {
        if (!translations[lang]) return;
        currentLang = lang;
        localStorage.setItem('app_lang', lang);
        localStorage.setItem('i18nextLng', lang);
        localStorage.setItem('user_language', lang);
        document.documentElement.lang = lang;

        updateUI();

        listeners.forEach(fn => {
            try { fn(lang); } catch (e) { console.error("i18n listener error:", e); }
        });
    }

    function updateUI() {
        const langInfo = flags[currentLang] || flags.ru;

        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = t(key);
            if (text) {
                el.textContent = text;
            }
        });

        // Update elements with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const text = t(key);
            if (text) {
                el.setAttribute('placeholder', text);
            }
        });

        // Update Login language switcher UI
        const loginFlag = document.getElementById('loginLangFlag');
        const loginCode = document.getElementById('loginLangCode');
        if (loginFlag) loginFlag.textContent = langInfo.flag;
        if (loginCode) loginCode.textContent = langInfo.code;

        // Update Settings language switcher UI
        const settingsFlag = document.getElementById('settingsLangFlag');
        const settingsDesc = document.getElementById('settingsCurrentLangText');
        if (settingsFlag) settingsFlag.textContent = langInfo.flag;
        if (settingsDesc) settingsDesc.textContent = `${langInfo.flag} ${langInfo.name}`;

        // Highlight active lang option in dropdowns
        document.querySelectorAll('.lang-option').forEach(opt => {
            const optLang = opt.getAttribute('data-lang');
            if (optLang === currentLang) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }

    function onLanguageChange(fn) {
        if (typeof fn === 'function') {
            listeners.push(fn);
        }
    }

    function setupDropdowns() {
        const loginBtn = document.getElementById('loginLangBtn');
        const loginMenu = document.getElementById('loginLangMenu');
        const settingsBtn = document.getElementById('settingsLangBtn');
        const settingsMenu = document.getElementById('settingsLangMenu');

        if (loginBtn && loginMenu) {
            loginBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                loginMenu.classList.toggle('hidden');
                if (settingsMenu) settingsMenu.classList.add('hidden');
            });
        }

        if (settingsBtn && settingsMenu) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                settingsMenu.classList.toggle('hidden');
                if (loginMenu) loginMenu.classList.add('hidden');
            });
        }

        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const selectedLang = opt.getAttribute('data-lang');
                if (selectedLang) {
                    setLanguage(selectedLang);
                }
                if (loginMenu) loginMenu.classList.add('hidden');
                if (settingsMenu) settingsMenu.classList.add('hidden');
            });
        });

        document.addEventListener('click', () => {
            if (loginMenu) loginMenu.classList.add('hidden');
            if (settingsMenu) settingsMenu.classList.add('hidden');
        });
    }

    function initI18n() {
        setupDropdowns();
        setLanguage(currentLang);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initI18n);
    } else {
        initI18n();
    }

    // Export to global scope
    window.i18n = {
        t,
        setLanguage,
        getCurrentLanguage: () => currentLang,
        onLanguageChange,
        flags
    };
    window.t = t;
})();
