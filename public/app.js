document.addEventListener("DOMContentLoaded", () => {

    // -----------------------------------------------------
    // 1. БИОМЕТРИЧЕСКАЯ АВТОРИЗАЦИЯ И СЕССИЯ (isAuth)
    // -----------------------------------------------------
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    const logoutBtn = document.getElementById('logoutBtn');

    // Biometric elements
    const bioStep1 = document.getElementById('bio-step-1');
    const bioStep2 = document.getElementById('bio-step-2');
    const bioStep1Form = document.getElementById('bioStep1Form');
    const btnBackToStep1 = document.getElementById('btnBackToStep1');
    const btnSubmitBiometrics = document.getElementById('btnSubmitBiometrics');
    const bioErrorMsg = document.getElementById('bio-error-msg');
    const video = document.getElementById('bio-webcam-video');
    let mediaStream = null;

    const profileLogoutBtn = document.getElementById('profileLogoutBtn');
    const btnGuestLogin = document.getElementById('btnGuestLogin');

    function getUserAvatar(username) {
        if (!username || username === 'Гость' || username === 'Анонимный гражданин') return '';
        return localStorage.getItem(`vaisperia_avatar_${username}`) || '';
    }

    function updateProfileAvatarUI() {
        const username = getCurrentUsername();
        const avatarUrl = getUserAvatar(username);
        
        const profileImg = document.getElementById('profile-avatar-img');
        const profileText = document.getElementById('profile-avatar-text');
        const tgImg = document.getElementById('tg-avatar-img');
        const tgText = document.getElementById('tg-avatar-text');
        
        if (avatarUrl) {
            if (profileImg) {
                profileImg.src = avatarUrl;
                profileImg.classList.remove('hidden');
            }
            if (profileText) profileText.classList.add('hidden');
            if (tgImg) {
                tgImg.src = avatarUrl;
                tgImg.classList.remove('hidden');
            }
            if (tgText) tgText.classList.add('hidden');
        } else {
            if (profileImg) profileImg.classList.add('hidden');
            if (profileText) {
                profileText.textContent = (username || 'ГР').substring(0, 2).toUpperCase();
                profileText.classList.remove('hidden');
            }
            if (tgImg) tgImg.classList.add('hidden');
            if (tgText) {
                tgText.textContent = (username || 'ГР').substring(0, 2).toUpperCase();
                tgText.classList.remove('hidden');
            }
        }
    }

    function checkAuth() {
        const isLoggedIn = (localStorage.getItem('vaisperia_isLoggedIn') === 'true' || localStorage.getItem('isAuth') === 'true');
        const isGuest = (localStorage.getItem('vaisperia_isGuest') === 'true');

        if (isLoggedIn || isGuest) {
            stopWebcam();
            loginScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
            
            const rawUsername = isLoggedIn ? (localStorage.getItem('vaisperia_username') || 'Гражданин') : (window.t ? window.t('guest_user', 'Гость') : 'Гость');
            const username = (rawUsername === 'Гражданин' && window.t) ? window.t('default_citizen', 'Гражданин') : rawUsername;
            const homeUserEl = document.getElementById('home-username');
            const profileUserTag = document.getElementById('profile-username-tag');
            
            if (homeUserEl) homeUserEl.textContent = username;
            if (profileUserTag) profileUserTag.textContent = username;

            updateProfileAvatarUI();

            // Управление видимостью анонимного чекбокса (только для зарегистрированных)
            const anonWrapper = document.getElementById('anonymous-option-wrapper');
            if (anonWrapper) {
                if (isLoggedIn) {
                    anonWrapper.classList.remove('hidden');
                } else {
                    anonWrapper.classList.add('hidden');
                    const anonCheckbox = document.getElementById('is-anonymous-checkbox');
                    if (anonCheckbox) anonCheckbox.checked = false;
                }
            }
            
            // Инициализация коинов
            initCoins();
            // Инициализация авто-геолокации
            initAutoGeoToggle();
            // Загрузка динамики
            loadProfileHistory();
            renderMyCoupons();
            renderShopItems();
            if (window.fetchProblemsAndDraw) {
                window.fetchProblemsAndDraw();
            }
            
            // Исправление отрисовки Leaflet при открытии
            if (map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 200);
            }
        } else {
            loginScreen.classList.remove('hidden');
            appScreen.classList.add('hidden');
            if (bioStep2) bioStep2.classList.add('hidden');
            if (bioStep1) bioStep1.classList.remove('hidden');
        }
    }

    if (btnGuestLogin) {
        btnGuestLogin.addEventListener('click', () => {
            localStorage.removeItem('vaisperia_isLoggedIn');
            localStorage.removeItem('isAuth');
            localStorage.removeItem('vaisperia_username');
            localStorage.setItem('vaisperia_isGuest', 'true');
            resetFormState();
            checkAuth();
        });
    }

    function showBioError(msg) {
        if (bioErrorMsg) {
            bioErrorMsg.textContent = msg;
            bioErrorMsg.style.display = 'block';
        }
    }

    function hideBioError() {
        if (bioErrorMsg) {
            bioErrorMsg.style.display = 'none';
        }
    }

    function formatDateTashkent(dateVal, options = {}) {
        if (!dateVal) return 'N/A';
        let d = new Date(dateVal);
        if (typeof dateVal === 'string' && !dateVal.includes('T') && !dateVal.includes('Z')) {
            d = new Date(dateVal.replace(' ', 'T') + 'Z');
        }
        if (isNaN(d.getTime())) return 'N/A';

        const langMap = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-US' };
        const currentLang = (window.i18n && typeof window.i18n.getCurrentLanguage === 'function') ? window.i18n.getCurrentLanguage() : 'ru';
        const localeCode = langMap[currentLang] || 'ru-RU';

        const defaultOpts = {
            timeZone: 'Asia/Tashkent',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };

        return d.toLocaleString(localeCode, Object.assign({}, defaultOpts, options));
    }

    function startWebcam() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
                .then(stream => {
                    mediaStream = stream;
                    if (video) video.srcObject = stream;
                })
                .catch(err => {
                    console.warn('Webcam stream unavailable:', err);
                });
        }
    }

    function stopWebcam() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (video) {
            video.srcObject = null;
        }
    }

    // Вычисление 64-мерного нормализованного вектора лица
    function captureFaceVector() {
        const canvas = document.getElementById('bio-canvas');
        if (!canvas) return [];
        const ctx = canvas.getContext('2d');

        if (video && video.readyState === 4) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } else {
            // Фолбэк симуляция кадра при отсутствии веб-камеры
            ctx.fillStyle = '#10b981';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#059669';
            ctx.beginPath();
            ctx.arc(80, 60, 40, 0, Math.PI * 2);
            ctx.fill();
        }

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const vector = [];
        const gridW = canvas.width / 8;
        const gridH = canvas.height / 8;

        for (let gy = 0; gy < 8; gy++) {
            for (let gx = 0; gx < 8; gx++) {
                let totalBright = 0;
                let count = 0;
                for (let y = Math.floor(gy * gridH); y < Math.floor((gy + 1) * gridH); y++) {
                    for (let x = Math.floor(gx * gridW); x < Math.floor((gx + 1) * gridW); x++) {
                        const idx = (y * canvas.width + x) * 4;
                        const r = data[idx];
                        const g = data[idx + 1];
                        const b = data[idx + 2];
                        const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
                        totalBright += bright;
                        count++;
                    }
                }
                vector.push(parseFloat((totalBright / (count || 1)).toFixed(4)));
            }
        }

        // Нормализация вектора
        const magnitude = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0)) || 1;
        return vector.map(val => parseFloat((val / magnitude).toFixed(4)));
    }

    // Шаг 1 -> Шаг 2
    if (bioStep1Form) {
        bioStep1Form.addEventListener('submit', (e) => {
            e.preventDefault();
            hideBioError();
            bioStep1.classList.add('hidden');
            bioStep2.classList.remove('hidden');
            startWebcam();
        });
    }

    // Назад на Шаг 1
    if (btnBackToStep1) {
        btnBackToStep1.addEventListener('click', () => {
            hideBioError();
            stopWebcam();
            bioStep2.classList.add('hidden');
            bioStep1.classList.remove('hidden');
        });
    }

    // Сканирование биометрии и динамическая обработка (POST /api/register)
    if (btnSubmitBiometrics) {
        btnSubmitBiometrics.addEventListener('click', async () => {
            hideBioError();
            const usernameInput = document.getElementById('username');
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            const username = usernameInput ? usernameInput.value.trim() : '';
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';

            const faceVector = captureFaceVector();
            if (!faceVector || !Array.isArray(faceVector) || faceVector.length === 0) {
                const scanErr = window.t ? window.t('bio_step2_hint') : 'Разместите лицо по центру каучуковой рамки.';
                showBioError(scanErr);
                return;
            }

            btnSubmitBiometrics.disabled = true;
            btnSubmitBiometrics.textContent = window.t ? window.t('scanning_and_verifying', 'Сканирование и проверка...') : 'Сканирование и проверка...';

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, email, faceVector })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    const finalUsername = data.username || username;
                    const finalEmail = data.email || email;
                    localStorage.setItem('vaisperia_isLoggedIn', 'true');
                    localStorage.setItem('isAuth', 'true');
                    localStorage.setItem('vaisperia_username', finalUsername);
                    if (finalEmail) {
                        localStorage.setItem(`vaisperia_email_${finalUsername}`, finalEmail);
                    }
                    localStorage.removeItem('vaisperia_isGuest');
                    stopWebcam();
                    btnSubmitBiometrics.disabled = false;
                    btnSubmitBiometrics.textContent = window.t ? window.t('complete_biometrics', 'Пройти биометрию') : 'Пройти биометрию';
                    checkAuth();
                } else {
                    const errKey = data.errorKey || data.error;
                    const errorMsg = window.t ? window.t(errKey, data.error || 'Ошибка биометрической авторизации.') : (data.error || 'Ошибка биометрической авторизации.');
                    showBioError(errorMsg);
                    btnSubmitBiometrics.disabled = false;
                    btnSubmitBiometrics.textContent = window.t ? window.t('complete_biometrics', 'Пройти биометрию') : 'Пройти биометрию';
                }
            } catch (err) {
                console.error("Biometric processing error:", err);
                const netErr = window.t ? window.t('err_network_submit', 'Ошибка соединения с сервером.') : 'Ошибка соединения с сервером.';
                showBioError(netErr);
                btnSubmitBiometrics.disabled = false;
                btnSubmitBiometrics.textContent = window.t ? window.t('complete_biometrics', 'Пройти биометрию') : 'Пройти биометрию';
            }
        });
    }

    function resetFormState() {
        const rForm = document.getElementById('reportForm');
        if (rForm) rForm.reset();
        
        const photoLbl = document.getElementById('photo-selected-name');
        if (photoLbl) {
            photoLbl.textContent = window.t ? (window.t('take_photo_onsite') || window.t('photo_dummy') || "Сделать снимок на месте") : "Сделать снимок на месте";
        }

        const cTiles = document.querySelectorAll('.category-tile');
        const cInput = document.getElementById('report-category');
        if (cTiles && cInput) {
            cTiles.forEach(t => t.classList.remove('selected'));
            const defTile = document.querySelector('.category-tile[data-value="Дороги"]');
            if (defTile) defTile.classList.add('selected');
            cInput.value = "Дороги";
        }

        const descInput = document.getElementById('description');
        if (descInput) descInput.value = "";

        const lLat = document.getElementById('latitude');
        const lLng = document.getElementById('longitude');
        if (lLat) lLat.value = "";
        if (lLng) lLng.value = "";
        localStorage.removeItem('selectedLat');
        localStorage.removeItem('selectedLng');

        const lStatus = document.getElementById('locationStatus');
        if (lStatus) {
            lStatus.textContent = window.t ? window.t('loc_loading', 'Загрузка геолокации...') : 'Загрузка геолокации...';
            lStatus.style.color = "var(--text-muted)";
        }

        const aCheckbox = document.getElementById('is-anonymous-checkbox');
        if (aCheckbox) aCheckbox.checked = false;

        const msgB = document.getElementById('messageBox');
        if (msgB) {
            msgB.className = "alert";
            msgB.textContent = "";
            msgB.style.display = "none";
        }

        const sBtn = document.getElementById('submitBtn');
        if (sBtn) {
            sBtn.disabled = true;
            sBtn.textContent = window.t ? (window.t('submit_report') || window.t('btn_submit_report') || "Отправить отчет") : "Отправить отчет";
        }
    }
    window.resetFormState = resetFormState;

    function performLogout() {
        localStorage.removeItem('vaisperia_isLoggedIn');
        localStorage.removeItem('isAuth');
        localStorage.removeItem('vaisperia_username');
        localStorage.removeItem('vaisperia_isGuest');
        resetFormState();
        checkAuth();
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', performLogout);
    }
    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener('click', performLogout);
    }

    // -----------------------------------------------------
    // 2. ИГРОВАЯ СИСТЕМА КОИНОВ (Gamification score)
    // -----------------------------------------------------
    function getCurrentUsername() {
        return localStorage.getItem('vaisperia_username') || '';
    }

    function getCoinsKey() {
        const user = getCurrentUsername() || 'guest';
        return `vaisperia_balance_${user}`;
    }

    function initCoins() {
        const user = getCurrentUsername();
        const key = getCoinsKey();
        let balance = localStorage.getItem(key);
        if (balance === null) {
            if (user === 'Adam_Vaisper') {
                balance = localStorage.getItem('vaisperia_balance') !== null ? localStorage.getItem('vaisperia_balance') : 340;
            } else {
                balance = 0;
            }
            localStorage.setItem(key, balance);
        }
        updateCoinsUI();
    }

    function getCoins() {
        const user = getCurrentUsername();
        const key = getCoinsKey();
        let balance = localStorage.getItem(key);
        if (balance === null) {
            return (user === 'Adam_Vaisper') ? 340 : 0;
        }
        return parseInt(balance, 10);
    }

    function addCoins(amount) {
        const current = getCoins();
        const updated = current + amount;
        localStorage.setItem(getCoinsKey(), updated);
        updateCoinsUI();
    }

    function updateCoinsUI() {
        const balance = getCoins();
        const homeBal = document.getElementById('home-balance');
        const profileBal = document.getElementById('profile-balance');
        
        if (homeBal) homeBal.textContent = balance;
        if (profileBal) profileBal.textContent = balance;
    }

    // Лимит баллов в день для пользователя
    function getDailyPoints() {
        const user = getCurrentUsername() || 'guest';
        const today = new Date().toISOString().split('T')[0];
        const data = localStorage.getItem(`vaisperia_dailyPoints_${user}`);
        if (!data) return 0;
        const [date, score] = data.split(':');
        if (date === today) {
            return parseInt(score, 10);
        }
        return 0;
    }

    function addDailyPoints(amount) {
        const user = getCurrentUsername() || 'guest';
        const today = new Date().toISOString().split('T')[0];
        const currentDaily = getDailyPoints();
        const newDaily = currentDaily + amount;
        localStorage.setItem(`vaisperia_dailyPoints_${user}`, `${today}:${newDaily}`);
    }

    function updateMonthProgress(problems) {
        const nowMs = Date.now();
        const window24h = 24 * 60 * 60 * 1000;
        
        let count = 0;
        if (Array.isArray(problems)) {
            problems.forEach(prob => {
                let state = typeof window.getProblemState === 'function' ? window.getProblemState(prob) : { createdAt: Date.now() };
                const createdTime = state.createdAt || (prob.timestamp ? Date.parse(prob.timestamp) : Date.now());
                if (!isNaN(createdTime) && (nowMs - createdTime <= window24h) && (nowMs >= createdTime)) {
                    count++;
                }
            });
        }
        
        const currentEl = document.getElementById('month-progress-current');
        const fillEl = document.getElementById('month-progress-fill');
        const percentEl = document.getElementById('month-progress-percent');
        
        if (currentEl) currentEl.textContent = count;
        if (fillEl) {
            const percent = Math.min(100, (count / 10) * 100);
            fillEl.style.width = percent + '%';
            if (percentEl) percentEl.textContent = Math.round(percent) + '%';
        }
    }


    function getAutoGeoKey() {
        const user = getCurrentUsername() || 'guest';
        return `vaisperia_auto_geo_${user}`;
    }

    function isAutoGeoEnabled() {
        const val = localStorage.getItem(getAutoGeoKey());
        return val === null ? true : (val === 'true');
    }

    function initAutoGeoToggle() {
        const toggle = document.getElementById('auto-geo-toggle');
        if (!toggle) return;
        toggle.checked = isAutoGeoEnabled();
        toggle.onchange = () => {
            localStorage.setItem(getAutoGeoKey(), toggle.checked ? 'true' : 'false');
        };
    }

    function requestLocationForReport(showModalOnFail = false) {
        const latInput = document.getElementById('latitude');
        const lngInput = document.getElementById('longitude');
        const locStatus = document.getElementById('locationStatus');
        const submitBtn = document.getElementById('submitBtn');

        const savedLat = localStorage.getItem('selectedLat');
        const savedLng = localStorage.getItem('selectedLng');

        if (savedLat && savedLng) {
            if (latInput && lngInput) {
                latInput.value = parseFloat(savedLat).toFixed(6);
                lngInput.value = parseFloat(savedLng).toFixed(6);
                if (locStatus) {
                    locStatus.textContent = "Координаты загружены с карты ✓";
                    locStatus.style.color = "#2ecc71";
                }
                if (submitBtn) submitBtn.disabled = false;
            }
            localStorage.removeItem('selectedLat');
            localStorage.removeItem('selectedLng');
            return;
        }

        if (!latInput || !lngInput) return;

        if ("geolocation" in navigator) {
            if (locStatus) {
                locStatus.textContent = "Загрузка геолокации...";
                locStatus.style.color = "var(--text-muted)";
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    latInput.value = position.coords.latitude.toFixed(6);
                    lngInput.value = position.coords.longitude.toFixed(6);
                    if (locStatus) {
                        locStatus.textContent = window.t ? window.t('loc_success', 'Геопозиция определена успешно ✓') : 'Геопозиция определена успешно ✓';
                        locStatus.style.color = "#2ecc71";
                    }
                    if (submitBtn) submitBtn.disabled = false;
                    const geoModal = document.getElementById('geo-modal');
                    if (geoModal) geoModal.classList.add('hidden');
                },
                (error) => {
                    console.warn("Geolocation prompt or access failed:", error);
                    if (locStatus) {
                        locStatus.textContent = window.t ? window.t('loc_denied', 'Геолокация отклонена. Укажите координаты на карте.') : 'Геолокация отклонена. Укажите координаты на карте.';
                        locStatus.style.color = "#ef4444";
                    }
                    if (submitBtn) submitBtn.disabled = false;
                    if (showModalOnFail) {
                        const geoModal = document.getElementById('geo-modal');
                        if (geoModal) geoModal.classList.remove('hidden');
                    }
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            if (locStatus) {
                locStatus.textContent = "Браузер не поддерживает автоопределение.";
                locStatus.style.color = "#ef4444";
            }
            if (submitBtn) submitBtn.disabled = false;
            if (showModalOnFail) {
                const geoModal = document.getElementById('geo-modal');
                if (geoModal) geoModal.classList.remove('hidden');
            }
        }
    }
    window.requestLocationForReport = requestLocationForReport;

    // -----------------------------------------------------
    // 3. НАВИГАЦИОННАЯ МНОГОЭКРАННАЯ SPA СИСТЕМА
    // -----------------------------------------------------
    const navTabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.tab-section');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Переключаем активный класс у кнопок навигации
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Переключаем отображение секций
            sections.forEach(sec => {
                if (sec.id === `section-${targetTab}`) {
                    sec.classList.remove('hidden');
                    sec.classList.add('active');
                } else {
                    sec.classList.remove('active');
                    sec.classList.add('hidden');
                }
            });
            
            // Если перешли к карте — пересчитываем размер canvas Leaflet
            if (targetTab === 'map' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 150);
            }

            // Если перешли в "Добавить", запрашиваем геолокацию при включенном автоопределении
            if (targetTab === 'report') {
                if (isAutoGeoEnabled()) {
                    requestLocationForReport(true);
                } else {
                    const savedLat = localStorage.getItem('selectedLat');
                    const savedLng = localStorage.getItem('selectedLng');
                    const latInput = document.getElementById('latitude');
                    const lngInput = document.getElementById('longitude');
                    const locStatus = document.getElementById('locationStatus');
                    const submitBtn = document.getElementById('submitBtn');
                    if (savedLat && savedLng && latInput && lngInput) {
                        latInput.value = parseFloat(savedLat).toFixed(6);
                        lngInput.value = parseFloat(savedLng).toFixed(6);
                        if (locStatus) {
                            locStatus.textContent = "Координаты загружены с карты ✓";
                            locStatus.style.color = "#2ecc71";
                        }
                        if (submitBtn) submitBtn.disabled = false;
                        localStorage.removeItem('selectedLat');
                        localStorage.removeItem('selectedLng');
                    }
                }
            }
            
            // При открытии профиля обновляем информацию
            if (targetTab === 'profile') {
                initAutoGeoToggle();
                loadProfileHistory();
                renderMyCoupons();
            }

            // При открытии магазина обновляем товары
            if (targetTab === 'shop') {
                renderShopItems();
            }
        });
    });


    // -----------------------------------------------------
    // 4. ОРИГИНАЛЬНАЯ ЛОГИКА ДЛЯ index.html (Карта Нукуса)
    // -----------------------------------------------------
    const mapElement = document.getElementById('map');
    let map = null;

    if (mapElement) {
        // Инициализация границ для Нукуса
        const bounds = [
            [42.40, 59.55], // South-West (bottom-left)
            [42.52, 59.70]  // North-East (top-right)
        ];

        // Инициализация карты (центр на Нукус)
        map = L.map('map', {
            minZoom: 12,
            maxZoom: 17,
            maxBoundsViscosity: 1.0,
            zoomAnimation: true,
            bounceAtZoomLimits: false // Предотвращает резкую остановку зума
        }).setView([42.4617, 59.6166], 13);
        
        // Ограничиваем перемещение карты рамками Нукуса
        map.setMaxBounds(bounds);

        // Добавляем спутниковые снимки Esri
        const satelliteLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
                attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
                maxZoom: 17
            }
        );
        satelliteLayer.addTo(map);

        // Индикатор загрузки карты
        const loadingBox = document.createElement('div');
        loadingBox.id = 'map-loading';
        loadingBox.textContent = 'Загрузка...';
        mapElement.appendChild(loadingBox);

        satelliteLayer.on('loading', () => {
            loadingBox.style.display = 'block';
        });
        satelliteLayer.on('load', () => {
            loadingBox.style.display = 'none';
        });

        // Обратная связь при максимальном зуме
        const zoomFeedback = document.createElement('div');
        zoomFeedback.id = 'max-zoom-feedback';
        zoomFeedback.textContent = 'Достигнут максимальный масштаб';
        mapElement.appendChild(zoomFeedback);

        let zoomTimeout;
        map.on('zoomend', () => {
            if (map.getZoom() >= 17) {
                zoomFeedback.classList.add('visible');
                clearTimeout(zoomTimeout);
                zoomTimeout = setTimeout(() => {
                    zoomFeedback.classList.remove('visible');
                }, 2000);
            }
        });

        // Попытка отцентрировать геопозицию пользователя
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(position => {
                map.setView([position.coords.latitude, position.coords.longitude], 14);
            });
        }

        let selectMarker = null;

        window.confirmLocationSelect = (lat, lng) => {
            localStorage.setItem('selectedLat', lat);
            localStorage.setItem('selectedLng', lng);

            const latInput = document.getElementById('latitude');
            const lngInput = document.getElementById('longitude');
            const locStatus = document.getElementById('locationStatus');
            const submitBtn = document.getElementById('submitBtn');

            if (latInput && lngInput) {
                latInput.value = parseFloat(lat).toFixed(6);
                lngInput.value = parseFloat(lng).toFixed(6);

                if (locStatus) {
                    locStatus.textContent = "Координаты выбраны на карте ✓";
                    locStatus.style.color = "#2ecc71";
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                }
            }

            if (selectMarker) {
                map.removeLayer(selectMarker);
                selectMarker = null;
            }
            if (map) {
                map.closePopup();
            }

            const addTabBtn = document.querySelector('.nav-tab[data-tab="report"]');
            if (addTabBtn) {
                addTabBtn.click();
            }
        };

        const handleLocationClick = (lat, lng) => {
            if (selectMarker) {
                map.removeLayer(selectMarker);
            }

            selectMarker = L.marker([lat, lng], {
                icon: createPinIcon('#3b82f6')
            }).addTo(map);

            const popupHtml = `
                <div style="text-align: center; padding: 4px;">
                    <div style="font-size: 0.8rem; font-weight: 700; margin-bottom: 4px; color: #1e293b;">📍 Выбранное место</div>
                    <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 8px;">${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}</div>
                    <button type="button" onclick="event.stopPropagation(); window.confirmLocationSelect(${lat}, ${lng});" class="btn-resolve" style="background: #10b981; margin: 0; width: 100%;">Выбрать эту точку</button>
                </div>
            `;

            selectMarker.bindPopup(popupHtml, {
                autoPan: true,
                autoPanPadding: [20, 20],
                maxWidth: 240
            }).openPopup();
        };

        // Клик по карте показывает маркер-превью и кнопку подтверждения
        map.on('click', function(e) {
            handleLocationClick(e.latlng.lat, e.latlng.lng);
        });

        // Кнопка статистики
        const statsBtn = document.createElement('button');
        statsBtn.type = 'button';
        statsBtn.id = 'stats-btn';
        statsBtn.textContent = 'Статистика';
        mapElement.appendChild(statsBtn);
        L.DomEvent.disableClickPropagation(statsBtn);

        // Кнопка тепловой карты
        const hotzonesBtn = document.createElement('button');
        hotzonesBtn.type = 'button';
        hotzonesBtn.id = 'hotzones-btn';
        hotzonesBtn.textContent = window.t ? window.t('map_hotspots', '🔥 Зоны скопления') : '🔥 Зоны скопления';
        mapElement.appendChild(hotzonesBtn);
        L.DomEvent.disableClickPropagation(hotzonesBtn);

        let heatLayer = null;
        let isHeatmapActive = false;

        hotzonesBtn.addEventListener('click', (e) => {
            if (e) e.stopPropagation();
            isHeatmapActive = !isHeatmapActive;
            hotzonesBtn.classList.toggle('active', isHeatmapActive);
            if (isHeatmapActive) {
                if (heatLayer) heatLayer.addTo(map);
            } else {
                if (heatLayer) map.removeLayer(heatLayer);
            }
        });

        const statsPanel = document.createElement('div');
        statsPanel.id = 'stats-panel';
        mapElement.appendChild(statsPanel);

        // Фильтры карты
        const filtersContainer = document.createElement('div');
        filtersContainer.id = 'map-filters';
        filtersContainer.innerHTML = `
            <button type="button" class="filter-btn active" data-filter="all">${window.t ? window.t('map_filter_all', 'Все') : 'Все'}</button>
            <button type="button" class="filter-btn" data-filter="new">${window.t ? window.t('map_filter_new', 'Новые') : 'Новые'}</button>
            <button type="button" class="filter-btn" data-filter="in_progress">${window.t ? window.t('map_filter_in_progress', 'В работе') : 'В работе'}</button>
            <button type="button" class="filter-btn" data-filter="resolved">${window.t ? window.t('map_filter_resolved', 'Решенные') : 'Решенные'}</button>
        `;
        mapElement.appendChild(filtersContainer);

        function updateMapUIElements() {
            if (statsBtn) statsBtn.textContent = window.t ? window.t('map_statistics', 'Статистика') : 'Статистика';
            if (hotzonesBtn) hotzonesBtn.textContent = window.t ? window.t('map_hotspots', '🔥 Зоны скопления') : '🔥 Зоны скопления';

            const btnAll = filtersContainer.querySelector('.filter-btn[data-filter="all"]');
            const btnNew = filtersContainer.querySelector('.filter-btn[data-filter="new"]');
            const btnProg = filtersContainer.querySelector('.filter-btn[data-filter="in_progress"]');
            const btnRes = filtersContainer.querySelector('.filter-btn[data-filter="resolved"]');

            if (btnAll) btnAll.textContent = window.t ? window.t('map_filter_all', 'Все') : 'Все';
            if (btnNew) btnNew.textContent = window.t ? window.t('map_filter_new', 'Новые') : 'Новые';
            if (btnProg) btnProg.textContent = window.t ? window.t('map_filter_in_progress', 'В работе') : 'В работе';
            if (btnRes) btnRes.textContent = window.t ? window.t('map_filter_resolved', 'Решенные') : 'Решенные';

            const currentAvgTime = document.getElementById('stat-avg-res-time') ? document.getElementById('stat-avg-res-time').textContent : 'N/A';
            const currentDensity = document.getElementById('stat-high-density') ? document.getElementById('stat-high-density').textContent : (window.t ? window.t('stat_analysis', 'Анализ...') : 'Анализ...');
            const currentTodayNew = document.getElementById('stat-today-new') ? document.getElementById('stat-today-new').textContent : '0';
            const currentTodayRes = document.getElementById('stat-today-res') ? document.getElementById('stat-today-res').textContent : '0';
            const currentCurrProg = document.getElementById('stat-curr-prog') ? document.getElementById('stat-curr-prog').textContent : '0';
            const currentMonthNew = document.getElementById('stat-month-new') ? document.getElementById('stat-month-new').textContent : '0';
            const currentMonthRes = document.getElementById('stat-month-res') ? document.getElementById('stat-month-res').textContent : '0';
            const currentYearNew = document.getElementById('stat-year-new') ? document.getElementById('stat-year-new').textContent : '0';
            const currentYearRes = document.getElementById('stat-year-res') ? document.getElementById('stat-year-res').textContent : '0';

            statsPanel.innerHTML = `
                <div class="stats-header">
                    <h3>${window.t ? window.t('stat_city_title', 'Статистика города') : 'Статистика города'}</h3>
                    <button type="button" id="stats-close">&times;</button>
                </div>
                <div class="stats-body">
                    <div class="stat-block">
                        <div class="stat-title">${window.t ? window.t('stat_work_summary', '🚨 Итоги работы') : '🚨 Итоги работы'}</div>
                        <div class="stat-row"><span>${window.t ? window.t('stat_avg_res_time_label', 'Среднее время решения') : 'Среднее время решения'}</span><span class="stat-number" id="stat-avg-res-time">${currentAvgTime}</span></div>
                        <div class="stat-row"><span>${window.t ? window.t('stat_coverage_zones', 'Покрытие зон') : 'Покрытие зон'}</span><span class="stat-number" id="stat-high-density" style="font-size: 0.8rem">${currentDensity}</span></div>
                    </div>
                    <div class="stat-block">
                        <div class="stat-title">${window.t ? window.t('stat_today', '📅 За сегодня') : '📅 За сегодня'}</div>
                        <div class="stat-row"><span><span class="color-dot red"></span>${window.t ? window.t('stat_new_reports', 'Новые заявки') : 'Новые заявки'}</span><span class="stat-number" id="stat-today-new">${currentTodayNew}</span></div>
                        <div class="stat-row"><span><span class="color-dot green"></span>${window.t ? window.t('stat_resolved_reports', 'Решенные') : 'Решенные'}</span><span class="stat-number" id="stat-today-res">${currentTodayRes}</span></div>
                    </div>
                    <div class="stat-block">
                        <div class="stat-title">${window.t ? window.t('stat_in_progress_title', '📊 В работе') : '📊 В работе'}</div>
                        <div class="stat-row"><span><span class="color-dot yellow"></span>${window.t ? window.t('stat_count', 'Количество') : 'Количество'}</span><span class="stat-number" id="stat-curr-prog">${currentCurrProg}</span></div>
                    </div>
                    <div class="stat-block">
                        <div class="stat-title">${window.t ? window.t('stat_this_month', '📆 За месяц') : '📆 За месяц'}</div>
                        <div class="stat-row"><span>${window.t ? window.t('stat_month_new_reports', 'Новые за месяц') : 'Новые за месяц'}</span><span class="stat-number" id="stat-month-new">${currentMonthNew}</span></div>
                        <div class="stat-row"><span>${window.t ? window.t('stat_resolved_reports', 'Решенные') : 'Решенные'}</span><span class="stat-number" id="stat-month-res">${currentMonthRes}</span></div>
                    </div>
                    <div class="stat-block">
                        <div class="stat-title">${window.t ? window.t('stat_this_year', '📈 За год') : '📈 За год'}</div>
                        <div class="stat-row"><span>${window.t ? window.t('stat_year_new_reports', 'Новые за год') : 'Новые за год'}</span><span class="stat-number" id="stat-year-new">${currentYearNew}</span></div>
                        <div class="stat-row"><span>${window.t ? window.t('stat_resolved_reports', 'Решенные') : 'Решенные'}</span><span class="stat-number" id="stat-year-res">${currentYearRes}</span></div>
                    </div>
                </div>
            `;

            const statsClose = document.getElementById('stats-close');
            if (statsClose) {
                statsClose.onclick = (e) => {
                    if (e) e.stopPropagation();
                    statsPanel.style.display = 'none';
                    statsBtn.style.display = 'block';
                };
            }
        }
        window.updateMapUIElements = updateMapUIElements;
        updateMapUIElements();

        L.DomEvent.disableClickPropagation(filtersContainer);
        L.DomEvent.disableClickPropagation(statsPanel);

        statsBtn.addEventListener('click', (e) => {
            if (e) e.stopPropagation();
            updateMapUIElements();
            statsPanel.style.display = 'flex';
            statsBtn.style.display = 'none';
        });

        // Управление состояниями (с поддержкой статусов сервера)
        const getProblemState = (problem) => {
            let timeMs = Date.now();
            if (problem.timestamp) {
                let formatted = problem.timestamp;
                if (typeof formatted === 'string' && !formatted.includes('T') && !formatted.includes('Z')) {
                    formatted = formatted.replace(' ', 'T') + 'Z';
                }
                const parsed = Date.parse(formatted);
                if (!isNaN(parsed)) {
                    timeMs = parsed;
                }
            }

            let resolvedAtMs = null;
            if (problem.resolved_at) {
                const parsedResolved = Date.parse(problem.resolved_at);
                if (!isNaN(parsedResolved)) resolvedAtMs = parsedResolved;
            }

            // Статус отчета форсируется СТРОГО из базы данных (без сбоев из-за локального кэша)
            let status = problem.status || 'new';

            // Авто-переход Красный ('new') -> Желтый ('in_progress') через 24 часа с момента создания
            const now = Date.now();
            if (status === 'new' && (now - timeMs >= 24 * 60 * 60 * 1000 || isNextCalendarDay(timeMs, now))) {
                status = 'in_progress';
            }

            return {
                status: status,
                createdAt: timeMs,
                resolvedAt: resolvedAtMs
            };
        };

        window.getProblemState = getProblemState; // Экспортируем в глобальную область для истории

        const saveProblemState = (id, state) => {
            localStorage.setItem('problemState_' + id, JSON.stringify(state));
        };

        const isNextCalendarDay = (date1_ms, date2_ms) => {
            const d1 = new Date(date1_ms);
            const d2 = new Date(date2_ms);
            const d1_only = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
            const d2_only = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
            return d2_only.getTime() > d1_only.getTime();
        };

        const createPinIcon = (color) => {
            return L.divIcon({
                className: 'custom-pin-icon',
                html: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 2C11.6 2 8 5.6 8 10c0 5 8 20 8 20s8-15 8-20c0-4.4-3.6-8-8-8zm0 11c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z" fill="${color}"/>
                </svg>`,
                iconSize: [32, 38],
                iconAnchor: [16, 38],
                popupAnchor: [0, -38]
            });
        };

        const icons = {
            'new': createPinIcon('#e74c3c'), // Red
            'in_progress': createPinIcon('#f1c40f'), // Yellow
            'resolved': createPinIcon('#2ecc71') // Green
        };

        const allMarkersData = [];
        let allDbProblemsData = [];
        let currentFilter = 'all';

        const updateHeatmap = () => {
             if (!heatLayer) {
                 heatLayer = L.layerGroup();
                 if (isHeatmapActive) heatLayer.addTo(map);
             } else {
                 heatLayer.clearLayers();
             }

             allMarkersData.forEach(item => {
                 const circle = L.circle([item.problem.latitude, item.problem.longitude], {
                     radius: 120,
                     color: '#FF0000',
                     weight: 2.5,
                     dashArray: '5, 5',
                     fillColor: '#FF3300',
                     fillOpacity: 0.2,
                     interactive: false
                 });
                 heatLayer.addLayer(circle);
                 if (circle.bringToBack) {
                     circle.bringToBack();
                 }
             });
        };

        const updateStatsUI = (problemsList) => {
            const list = (problemsList && Array.isArray(problemsList)) ? problemsList : allDbProblemsData;
            if (!list || !Array.isArray(list)) return;

            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const currentDate = now.getDate();

            let stats = { todayNew: 0, todayResolved: 0, currentInProgress: 0, monthNew: 0, monthResolved: 0, yearNew: 0, yearResolved: 0 };
            
            let totalResolutionMs = 0;
            let resolvedWithDatesCount = 0;
            let areaGridCounts = {};

            list.forEach(problem => {
                const state = getProblemState(problem);
                const created = new Date(state.createdAt);

                const latKey = problem.latitude.toFixed(2);
                const lngKey = problem.longitude.toFixed(2);
                const gridKey = latKey + ',' + lngKey;
                areaGridCounts[gridKey] = (areaGridCounts[gridKey] || 0) + 1;

                if (created.getFullYear() === currentYear) {
                    stats.yearNew++;
                    if (created.getMonth() === currentMonth) {
                        stats.monthNew++;
                        if (created.getDate() === currentDate) {
                            stats.todayNew++;
                        }
                    }
                }

                if (state.status === 'new' || state.status === 'in_progress') {
                    stats.currentInProgress++;
                }

                if (state.status === 'resolved' && state.resolvedAt) {
                    totalResolutionMs += (state.resolvedAt - state.createdAt);
                    resolvedWithDatesCount++;

                    const resolved = new Date(state.resolvedAt);
                    if (resolved.getFullYear() === currentYear) {
                        stats.yearResolved++;
                        if (resolved.getMonth() === currentMonth) {
                            stats.monthResolved++;
                            if (resolved.getDate() === currentDate) {
                                stats.todayResolved++;
                            }
                        }
                    }
                }
            });

            // Расчет строки среднего времени решения
            const avgEl = document.getElementById('stat-avg-res-time');
            if (avgEl) {
                if (resolvedWithDatesCount > 0) {
                    const avgMs = totalResolutionMs / resolvedWithDatesCount;
                    const avgHours = avgMs / (1000 * 60 * 60);
                    let avgStr = "";
                    if (avgHours < 24) {
                        avgStr = Math.max(1, Math.round(avgHours)) + " ч.";
                    } else {
                        avgStr = Math.round(avgHours / 24) + " дн.";
                    }
                    avgEl.textContent = avgStr;
                } else {
                    avgEl.textContent = "N/A";
                }
            }

            // Выявление зон большой скопленности
            let highestDensity = 0;
            for (const key in areaGridCounts) {
                if (areaGridCounts[key] > highestDensity) {
                    highestDensity = areaGridCounts[key];
                }
            }
            const densityEl = document.getElementById('stat-high-density');
            if (densityEl) {
                if (highestDensity >= 3) {
                     densityEl.textContent = window.t ? (window.t('multiple_hotspots') || window.t('stat_high_density_clusters') || "Множеств. очаги") : "Множеств. очаги";
                } else if (highestDensity > 0) {
                     densityEl.textContent = window.t ? window.t('stat_scattered_cases', 'Рассеянные случаи') : "Рассеянные случаи";
                } else {
                     densityEl.textContent = window.t ? window.t('stat_no_data', 'Нет данных') : "Нет данных";
                }
            }

            const elTodayNew = document.getElementById('stat-today-new');
            const elTodayRes = document.getElementById('stat-today-res');
            const elCurrProg = document.getElementById('stat-curr-prog');
            const elMonthNew = document.getElementById('stat-month-new');
            const elMonthRes = document.getElementById('stat-month-res');
            const elYearNew = document.getElementById('stat-year-new');
            const elYearRes = document.getElementById('stat-year-res');

            if (elTodayNew) elTodayNew.textContent = stats.todayNew;
            if (elTodayRes) elTodayRes.textContent = stats.todayResolved;
            if (elCurrProg) elCurrProg.textContent = stats.currentInProgress;
            if (elMonthNew) elMonthNew.textContent = stats.monthNew;
            if (elMonthRes) elMonthRes.textContent = stats.monthResolved;
            if (elYearNew) elYearNew.textContent = stats.yearNew;
            if (elYearRes) elYearRes.textContent = stats.yearResolved;
        };

        const applyFilter = () => {
            allMarkersData.forEach(item => {
                const isMatch = currentFilter === 'all' || item.state.status === currentFilter;
                if (isMatch) {
                    if (!map.hasLayer(item.marker)) {
                        map.addLayer(item.marker);
                    }
                } else {
                    if (map.hasLayer(item.marker)) {
                        map.removeLayer(item.marker);
                    }
                }
            });
        };

        // Слушатели фильтров
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e) e.stopPropagation();
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentFilter = e.target.dataset.filter;
                applyFilter();
            });
        });

        // Helper for Author Badge with Avatar (Strict Anonymity Override)
        const getAuthorHtml = (problem) => {
            const rawUsername = problem.username || '';
            const isAnon = (
                problem.is_anonymous == 1 ||
                problem.is_anonymous === '1' ||
                problem.is_anonymous === true ||
                problem.is_anonymous === 'true' ||
                rawUsername === 'Анонимный гражданин' ||
                rawUsername === 'Гость' ||
                !rawUsername
            );

            if (isAnon) {
                const anonText = window.t ? (window.t('author_anonymous') || window.t('anonymous_citizen') || 'Анонимный гражданин') : 'Анонимный гражданин';
                return `
                    <div class="sheet-author-badge anon">
                        <span class="author-icon">👤</span>
                        <span class="author-name">${anonText}</span>
                    </div>
                `;
            }

            const authorName = rawUsername;
            const avatarUrl = problem.user_avatar || getUserAvatar(authorName);

            const avatarMarkup = avatarUrl 
                ? `<img src="${avatarUrl}" class="author-avatar-img" alt="${authorName}">`
                : `<div class="author-avatar-letter">${authorName.substring(0, 2).toUpperCase()}</div>`;

            return `
                <div class="sheet-author-badge user">
                    ${avatarMarkup}
                    <span class="author-name">${authorName}</span>
                </div>
            `;
        };

        const getStatusBadgeText = (st) => {
            if (st === 'new') return (window.t ? window.t('status_new', 'Новый') : 'Новый');
            if (st === 'in_progress') return (window.t ? window.t('status_in_progress', 'В обработке') : 'В обработке');
            return (window.t ? window.t('status_resolved', 'Решено') : 'Решено');
        };

        // Генерация всплывающего окна
        const getPopupContent = (problem, state) => {
            let html = `<div class="popup-container">`;
            if (problem.photo_url) {
                html += `<img src="${problem.photo_url}" class="popup-img" alt="Problem photo">`;
            }
            html += getAuthorHtml(problem);
            const descLabel = window.t ? window.t('desc_label_short', 'Описание:') : 'Описание:';
            html += `<div class="popup-details"><strong>${descLabel}</strong> ${problem.description}</div>`;
            
            let statusLabel = getStatusBadgeText(state.status);
            const statusTextHeader = window.t ? window.t('status_label', 'Статус:') : 'Статус:';
            const createdTextHeader = window.t ? window.t('created_label', 'Создана:') : 'Создана:';
            html += `
                <div class="popup-meta">
                    <div>${statusTextHeader} <span class="status-badge ${state.status}">${statusLabel}</span></div>
                    <div>${createdTextHeader} ${formatDateTashkent(state.createdAt)}</div>
            `;
            
            if (state.status === 'resolved' && state.resolvedAt) {
                 const resolvedTextHeader = window.t ? window.t('resolved_label', 'Решено:') : 'Решено:';
                 html += `<div>${resolvedTextHeader} ${formatDateTashkent(state.resolvedAt)}</div>`;
            }
            html += `</div>`;
            html += `</div>`;
            return html;
        };

        function openBottomSheet(problem, state, clusterList = null, clusterIndex = 0) {
            let sheet = document.getElementById('report-bottom-sheet');
            if (!sheet) {
                sheet = document.createElement('div');
                sheet.id = 'report-bottom-sheet';
                sheet.className = 'report-bottom-sheet hidden';
                sheet.innerHTML = `
                    <button type="button" class="bottom-sheet-close" id="bottomSheetCloseBtn">&times;</button>
                    <div class="bottom-sheet-content" id="bottomSheetContent"></div>
                `;
                mapElement.appendChild(sheet);
                L.DomEvent.disableClickPropagation(sheet);
                
                sheet.querySelector('#bottomSheetCloseBtn').addEventListener('click', (e) => {
                    if (e) e.stopPropagation();
                    closeBottomSheet();
                });
            }

            // Поиск соседних отчетов в той же локации (радиус ~250м), если список не был передан
            if (!clusterList) {
                const targetLat = problem.latitude;
                const targetLng = problem.longitude;
                clusterList = (allDbProblemsData || []).filter(p => {
                    const dLat = Math.abs(p.latitude - targetLat);
                    const dLng = Math.abs(p.longitude - targetLng);
                    return dLat <= 0.003 && dLng <= 0.003;
                });
                clusterIndex = clusterList.findIndex(p => p.id === problem.id);
                if (clusterIndex === -1) {
                    clusterList = [problem];
                    clusterIndex = 0;
                }
            }

            const currentProblem = clusterList[clusterIndex] || problem;
            const currentState = getProblemState(currentProblem);

            const contentContainer = sheet.querySelector('#bottomSheetContent');
            let statusLabel = getStatusBadgeText(currentState.status);
            let dateStr = formatDateTashkent(currentState.createdAt);

            const prevTitleText = window.t ? window.t('carousel_prev_title', 'Предыдущий отчет') : 'Предыдущий отчет';
            const nextTitleText = window.t ? window.t('carousel_next_title', 'Следующий отчет') : 'Следующий отчет';

            // Кнопки карусели и счетчик близлежащих отчетов
            let carouselControls = "";
            if (clusterList.length > 1) {
                carouselControls = `
                    <div class="carousel-counter">${clusterIndex + 1} / ${clusterList.length}</div>
                    <button type="button" class="carousel-arrow prev" id="carouselPrevBtn" title="${prevTitleText}">◀</button>
                    <button type="button" class="carousel-arrow next" id="carouselNextBtn" title="${nextTitleText}">▶</button>
                `;
            }

            let imgHtml = "";
            const noPhotoText = window.t ? window.t('no_photo', '📷 Фотография отсутствует') : '📷 Фотография отсутствует';
            if (currentProblem.photo_url) {
                imgHtml = `
                    <div class="sheet-img-container">
                        <img src="${currentProblem.photo_url}" class="sheet-img" alt="Фото проблемы">
                        ${carouselControls}
                    </div>
                `;
            } else {
                imgHtml = `
                    <div class="sheet-img-container">
                        <div class="sheet-no-img">${noPhotoText}</div>
                        ${carouselControls}
                    </div>
                `;
            }

            const descLabelText = window.t ? window.t('desc_label_short', 'Описание:') : 'Описание:';
            let html = `
                ${imgHtml}
                <div class="sheet-details">
                    ${getAuthorHtml(currentProblem)}
                    <div class="sheet-header">
                        <span class="status-badge ${currentState.status}">${statusLabel}</span>
                        <span class="sheet-date">📅 ${dateStr}</span>
                    </div>
                    <p class="sheet-desc"><strong>${descLabelText}</strong> ${currentProblem.description}</p>
            `;

            if (currentState.status === 'resolved' && currentState.resolvedAt) {
                const resolvedLabelText = window.t ? window.t('resolved_label', 'Решено:') : 'Решено:';
                html += `<div class="sheet-resolved-date">${resolvedLabelText} ${formatDateTashkent(currentState.resolvedAt)}</div>`;
            }

            html += `</div>`;

            contentContainer.innerHTML = html;
            sheet.classList.remove('hidden');
            sheet.classList.add('active');

            // Навешивание обработчиков стрелок карусели
            if (clusterList.length > 1) {
                const prevBtn = contentContainer.querySelector('#carouselPrevBtn');
                const nextBtn = contentContainer.querySelector('#carouselNextBtn');

                if (prevBtn) {
                    prevBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const newIdx = (clusterIndex - 1 + clusterList.length) % clusterList.length;
                        openBottomSheet(clusterList[newIdx], getProblemState(clusterList[newIdx]), clusterList, newIdx);
                    });
                }
                if (nextBtn) {
                    nextBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const newIdx = (clusterIndex + 1) % clusterList.length;
                        openBottomSheet(clusterList[newIdx], getProblemState(clusterList[newIdx]), clusterList, newIdx);
                    });
                }
            }
        }

        function closeBottomSheet() {
            const sheet = document.getElementById('report-bottom-sheet');
            if (sheet) {
                sheet.classList.remove('active');
                sheet.classList.add('hidden');
            }
        }

        // Глобальный триггер изменения статуса заявки
        window.markProblemResolved = (id) => {
            const item = allMarkersData.find(i => i.problem.id === id);
            const problem = item ? item.problem : allDbProblemsData.find(p => p.id === id);
            if (!problem) return;

            const state = getProblemState(problem);
            state.status = 'resolved';
            state.resolvedAt = Date.now();
            saveProblemState(problem.id, state);
            
            if (item) {
                item.marker.setIcon(icons['resolved']);
            }
            updateStatsUI(allDbProblemsData);
            applyFilter();
            updateHeatmap();
            
            openBottomSheet(problem, state);
            loadProfileHistory();
        };

        // Запрос всех заявок и построение/обновление меток
        function fetchProblemsAndDraw(isPolling = false) {
            fetch('/api/problems')
                .then(response => response.json())
                .then(data => {
                    allDbProblemsData = data;
                    const now = Date.now();

                    if (!isPolling) {
                        // Полный перерендер (первоначальная загрузка или добавление новой заявки)
                        allMarkersData.forEach(item => {
                            map.removeLayer(item.marker);
                        });
                        allMarkersData.length = 0;

                        data.forEach(problem => {
                            let state = getProblemState(problem);
                            let stateChanged = false;

                            // Переход в работу на след. календарные сутки
                            if (state.status === 'new' && isNextCalendarDay(state.createdAt, now)) {
                                state.status = 'in_progress';
                                stateChanged = true;
                            }

                            // Скрытие старых закрытых заявок на след. день
                            if (state.status === 'resolved' && state.resolvedAt && isNextCalendarDay(state.resolvedAt, now)) {
                                return; 
                            }

                            if (stateChanged) {
                                saveProblemState(problem.id, state);
                            }

                            const marker = L.marker([problem.latitude, problem.longitude], {
                                icon: icons[state.status] || icons['new']
                            });

                            marker.on('click', (e) => {
                                if (e && e.originalEvent) e.originalEvent.stopPropagation();
                                map.panTo([problem.latitude, problem.longitude], { animate: true });
                                openBottomSheet(problem, state);
                            });
                            marker.addTo(map);

                            allMarkersData.push({ problem, state, marker });
                        });
                    } else {
                        // Бесшовное авто-обновление маркеров каждые 5 сек без перезагрузки и мигания
                        data.forEach(problem => {
                            let state = getProblemState(problem);

                            // Скрытие закрытых заявок прошедших дней
                            if (state.status === 'resolved' && state.resolvedAt && isNextCalendarDay(state.resolvedAt, now)) {
                                const idx = allMarkersData.findIndex(item => item.problem.id === problem.id);
                                if (idx !== -1) {
                                    map.removeLayer(allMarkersData[idx].marker);
                                    allMarkersData.splice(idx, 1);
                                }
                                return;
                            }

                            const existingItem = allMarkersData.find(item => item.problem.id === problem.id);
                            if (existingItem) {
                                // Если статус изменился из Telegram (в работу/решено), бесшовно меняем иконку
                                if (existingItem.state.status !== state.status) {
                                    existingItem.state.status = state.status;
                                    existingItem.state.resolvedAt = state.resolvedAt;
                                    if (icons[state.status]) {
                                        existingItem.marker.setIcon(icons[state.status]);
                                    }
                                }
                            } else {
                                // Новая метка, созданная параллельно
                                const marker = L.marker([problem.latitude, problem.longitude], {
                                    icon: icons[state.status] || icons['new']
                                });

                                marker.on('click', (e) => {
                                    if (e && e.originalEvent) e.originalEvent.stopPropagation();
                                    map.panTo([problem.latitude, problem.longitude], { animate: true });
                                    openBottomSheet(problem, state);
                                });
                                marker.addTo(map);

                                allMarkersData.push({ problem, state, marker });
                            }
                        });
                    }

                    updateStatsUI(allDbProblemsData);
                    updateHeatmap();

                    const currentUsername = getCurrentUsername();
                    const isGuest = (localStorage.getItem('vaisperia_isGuest') === 'true');
                    let userProblemsForMonth = [];
                    if (!isGuest && currentUsername) {
                        userProblemsForMonth = data.filter(prob => prob.username === currentUsername || prob.user_id_name === currentUsername);
                    }
                    updateMonthProgress(userProblemsForMonth);
                })
                .catch(error => console.error("Error fetching problems:", error));
        }

        fetchProblemsAndDraw();
        window.fetchProblemsAndDraw = fetchProblemsAndDraw;

        // Живой авто-опрос сервера каждые 5 секунд для обновления статусов диспетчера
        setInterval(() => {
            fetchProblemsAndDraw(true);
        }, 5000);
    }


    // -----------------------------------------------------
    // 5. ОРИГИНАЛЬНАЯ ЛОГИКА ФОРМЫ (Report Form)
    // -----------------------------------------------------
    const reportForm = document.getElementById('reportForm');
    
    if (reportForm) {
        const latInput = document.getElementById('latitude');
        const lngInput = document.getElementById('longitude');
        const locStatus = document.getElementById('locationStatus');
        const submitBtn = document.getElementById('submitBtn');
        const messageBox = document.getElementById('messageBox');
        const photoInput = document.getElementById('photo');
        const photoLabel = document.getElementById('photo-selected-name');
        
        const emergencyCategories = {
            'Газ': {
                phone: '104',
                catKey: 'cat_gas',
                translationKey: 'cat_gas_warn',
                text: '⚠️ Возможна угроза жизни. Если вы чувствуете запах газа: покиньте помещение, не включайте свет, позвоните в 104.'
            },
            'Пожар': {
                phone: '101',
                catKey: 'cat_fire',
                translationKey: 'cat_fire_warn',
                text: '⚠️ Если существует открытое пламя — сначала вызовите пожарную службу (101). Не тратьте время на заполнение формы.'
            },
            'Электричество': {
                phone: '112',
                catKey: 'cat_electricity',
                translationKey: 'cat_elec_warn',
                text: '⚠️ Опасность поражения током! При повреждении линий электропередач или искрении держитесь на расстоянии и вызовите аварийную службу (1054 или 112).'
            },
            'Вода': {
                phone: '112',
                catKey: 'cat_water',
                translationKey: 'cat_water_warn',
                text: '⚠️ Прорыв магистрального водопровода или затопление. Срочно свяжитесь с аварийной службой водоканала (1055 или 112).'
            },
            'Дорожная авария': {
                phone: '102',
                catKey: 'cat_accident',
                translationKey: 'cat_accident_warn',
                text: '⚠️ Опасность на дороге! При наличии пострадавших немедленно вызовите скорую помощь (103) и ГАИ (102).'
            },
            'Опасные вещества': {
                phone: '112',
                catKey: 'cat_hazard',
                translationKey: 'cat_hazard_warn',
                text: '⚠️ Угроза химического заражения или отравления! Покиньте опасную зону и немедленно вызовите службу МЧС (112).'
            }
        };

        function showSafetyModal(category, info) {
            const modal = document.getElementById('safety-modal');
            const titleEl = document.getElementById('safety-modal-title');
            const textEl = document.getElementById('safety-modal-text');
            const callBtn = document.getElementById('safety-emergency-call-btn');
            
            if (modal && titleEl && textEl && callBtn) {
                const titleText = window.t ? window.t('safety_title', 'Экстренное предупреждение') : 'Экстренное предупреждение';
                const catName = info.catKey ? (window.t ? window.t(info.catKey, category) : category) : category;
                titleEl.textContent = `⚠️ ${titleText}: ${catName}`;
                textEl.textContent = info.translationKey ? (window.t ? window.t(info.translationKey, info.text) : info.text) : info.text;
                callBtn.setAttribute('href', `tel:${info.phone}`);
                const callBtnTemplate = window.t ? window.t('btn_emergency_call_num', '📞 Позвонить в аварийную службу ({num})') : '📞 Позвонить в аварийную службу ({num})';
                callBtn.textContent = callBtnTemplate.replace('{num}', info.phone);
                modal.classList.remove('hidden');
            }
        }

        const safetyContinueBtn = document.getElementById('safety-continue-btn');
        const safetyModal = document.getElementById('safety-modal');

        if (safetyContinueBtn && safetyModal) {
            safetyContinueBtn.addEventListener('click', () => {
                safetyModal.classList.add('hidden');
            });
        }
        if (safetyModal) {
            safetyModal.addEventListener('click', (e) => {
                if (e.target === safetyModal) {
                    safetyModal.classList.add('hidden');
                }
            });
        }

        // Плитки категорий события
        const categoryTiles = document.querySelectorAll('.category-tile');
        const categoryInput = document.getElementById('report-category');
        if (categoryTiles && categoryInput) {
            categoryTiles.forEach(tile => {
                tile.addEventListener('click', () => {
                    categoryTiles.forEach(t => t.classList.remove('selected'));
                    tile.classList.add('selected');
                    const selectedVal = tile.dataset.value;
                    categoryInput.value = selectedVal;
                    
                    if (emergencyCategories[selectedVal]) {
                        showSafetyModal(selectedVal, emergencyCategories[selectedVal]);
                    }
                });
            });
        }
        
        // Индикация выбранного файла (с обрезкой длинного имени)
        if (photoInput && photoLabel) {
            photoInput.addEventListener('change', () => {
                if (photoInput.files.length > 0) {
                    const rawName = photoInput.files[0].name;
                    if (rawName.length > 25) {
                        const ext = rawName.includes('.') ? rawName.substring(rawName.lastIndexOf('.')) : '';
                        const base = rawName.includes('.') ? rawName.substring(0, rawName.lastIndexOf('.')) : rawName;
                        photoLabel.textContent = base.substring(0, 20) + '...' + ext;
                    } else {
                        photoLabel.textContent = rawName;
                    }
                } else {
                    photoLabel.textContent = window.t ? (window.t('take_photo_onsite') || window.t('photo_dummy') || "Сделать снимок на месте") : "Сделать снимок на месте";
                }
            });
        }

        // Обработчики кнопок модального окна разрешения геолокации
        const btnGeoAllow = document.getElementById('btn-geo-allow');
        const btnGeoLater = document.getElementById('btn-geo-later');
        const geoModal = document.getElementById('geo-modal');

        if (btnGeoAllow) {
            btnGeoAllow.addEventListener('click', () => {
                if (geoModal) geoModal.classList.add('hidden');
                requestLocationForReport(true);
            });
        }
        if (btnGeoLater) {
            btnGeoLater.addEventListener('click', () => {
                if (geoModal) geoModal.classList.add('hidden');
            });
        }
        if (geoModal) {
            geoModal.addEventListener('click', (e) => {
                if (e.target === geoModal) {
                    geoModal.classList.add('hidden');
                }
            });
        }

        // Автоопределение локации при старте формы
        if (isAutoGeoEnabled()) {
            requestLocationForReport(false);
        } else {
            const savedLat = localStorage.getItem('selectedLat');
            const savedLng = localStorage.getItem('selectedLng');
            if (savedLat && savedLng) {
                latInput.value = parseFloat(savedLat).toFixed(6);
                lngInput.value = parseFloat(savedLng).toFixed(6);
                locStatus.textContent = window.t ? window.t('loc_from_map', 'Координаты загружены с карты ✓') : 'Координаты загружены с карты ✓';
                locStatus.style.color = "green";
                submitBtn.disabled = false;
                localStorage.removeItem('selectedLat');
                localStorage.removeItem('selectedLng');
            } else {
                locStatus.textContent = window.t ? window.t('loc_denied', 'Укажите координаты на карте или введите вручную.') : 'Укажите координаты на карте или введите вручную.';
                locStatus.style.color = "var(--text-muted)";
                submitBtn.disabled = false;
            }
        }

        latInput.addEventListener('input', () => { submitBtn.disabled = false; });
        lngInput.addEventListener('input', () => { submitBtn.disabled = false; });

        // Отправка формы через Multipart
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            messageBox.className = "alert";
            messageBox.textContent = "";
            messageBox.style.display = "none";

            const descValue = document.getElementById('description') ? document.getElementById('description').value.trim() : '';
            const latValue = latInput ? latInput.value.trim() : '';
            const lngValue = lngInput ? lngInput.value.trim() : '';
            let file = photoInput.files[0];

            // Кастомная валидация обязательных полей без нативных браузерных тултипов
            if (!file || !descValue || !latValue || !lngValue) {
                showMessage(window.t ? window.t('err_fill_all_fields', 'Пожалуйста, заполните все обязательные поля: фото, описание и координаты.') : 'Пожалуйста, заполните все обязательные поля: фото, описание и координаты.', "error");
                return;
            }
            
            // Клиентская валидация размера файла (5 МБ)
            if (file && file.size > 5 * 1024 * 1024) {
                showMessage(window.t ? window.t('err_file_size', 'Размер файла не должен превышать 5 МБ.') : 'Размер файла не должен превышать 5 МБ.', "error");
                return;
            }

            // Обрезка слишком длинного имени файла перед отправкой на сервер
            if (file && file.name.length > 25) {
                const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
                const base = file.name.includes('.') ? file.name.substring(0, file.name.lastIndexOf('.')) : file.name;
                const truncatedName = base.substring(0, 20) + ext;
                file = new File([file], truncatedName, { type: file.type });
            }

            const formData = new FormData(reportForm);
            if (file) {
                formData.set('photo', file);
            }
            const isLoggedIn = (localStorage.getItem('vaisperia_isLoggedIn') === 'true' || localStorage.getItem('isAuth') === 'true');
            const currentUsername = localStorage.getItem('vaisperia_username') || 'Adam_Vaisper';
            
            const anonCheckbox = document.getElementById('is-anonymous-checkbox');
            const isAnonChecked = isLoggedIn && anonCheckbox && anonCheckbox.checked;

            const anonNameStr = window.t ? (window.t('author_anonymous') || window.t('anonymous_citizen') || 'Анонимный гражданин') : 'Анонимный гражданин';

            if (isLoggedIn) {
                if (isAnonChecked) {
                    formData.set('username', anonNameStr);
                    formData.set('userAvatar', '');
                    formData.set('isAnonymous', 'true');
                } else {
                    formData.set('username', currentUsername);
                    formData.set('userAvatar', getUserAvatar(currentUsername));
                    formData.set('isAnonymous', 'false');
                }
            } else {
                formData.set('username', 'Гость');
                formData.set('userAvatar', '');
                formData.set('isAnonymous', 'true');
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = window.t ? (window.t('submitting') || window.t('btn_submitting') || 'Отправка...') : 'Отправка...';

                const response = await fetch('/api/problems', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    // НАЧИСЛЕНИЕ БАЛЛОВ (только для зарегистрированных)
                    if (isLoggedIn) {
                        const daily = getDailyPoints();
                        let coinsToAdd = 0;
                        
                        if (daily >= 100) {
                            showMessage(window.t ? window.t('msg_limit_exceeded', 'Отчет успешно создан! Вы превысили дневной лимит в 100 баллов, новые коины не начислены.') : 'Отчет успешно создан! Вы превысили дневной лимит в 100 баллов, новые коины не начислены.', "success");
                        } else {
                            const descText = document.getElementById('description').value.trim();
                            if (descText.length >= 30) {
                                coinsToAdd = 10;
                            } else {
                                coinsToAdd = 5;
                            }
                            
                            const remaining = 100 - daily;
                            if (coinsToAdd > remaining) {
                                coinsToAdd = remaining;
                            }
                            
                            if (coinsToAdd > 0) {
                                addCoins(coinsToAdd);
                                addDailyPoints(coinsToAdd);
                                const msgTemplate = window.t ? window.t('msg_report_success_coins', 'Отчет успешно создан! Начислено +{coins} эко-коинов 🍃') : 'Отчет успешно создан! Начислено +{coins} эко-коинов 🍃';
                                showMessage(msgTemplate.replace('{coins}', coinsToAdd), "success");
                            } else {
                                showMessage(window.t ? window.t('msg_report_created', 'Отчет успешно создан!') : 'Отчет успешно создан!', "success");
                            }
                        }
                    } else {
                        showMessage(window.t ? window.t('msg_report_guest_created', 'Отчет успешно создан анонимно! (В гостевом режиме баллы и профиль не сохраняются).') : 'Отчет успешно создан анонимно! (В гостевом режиме баллы и профиль не сохраняются).', "success");
                    }

                    // Очистка формы через resetFormState
                    resetFormState();

                    // Обновляем карту в фоне
                    if (window.fetchProblemsAndDraw) {
                        window.fetchProblemsAndDraw();
                    }

                    // Переключаем на карту через 2 секунды
                    setTimeout(() => {
                        messageBox.style.display = "none";
                        submitBtn.disabled = false;
                        submitBtn.textContent = window.t ? (window.t('submit_report') || window.t('btn_submit_report') || "Отправить отчет") : "Отправить отчет";
                        
                        const mapTab = document.querySelector('.nav-tab[data-tab="map"]');
                        if (mapTab) {
                            mapTab.click();
                        }
                    }, 2000);

                } else {
                    const errText = data.error || "";
                    if (errText === "Field value too long" || errText.includes("Field value too long") || errText.includes("LIMIT_FIELD_VALUE")) {
                        showMessage(window.t ? window.t('errors.field_too_long', 'Значение поля слишком длинное.') : 'Значение поля слишком длинное.', "error");
                    } else {
                        showMessage(errText || "Неизвестная ошибка сервера.", "error");
                    }
                    submitBtn.disabled = false;
                    submitBtn.textContent = window.t ? (window.t('submit_report') || window.t('btn_submit_report') || "Отправить отчет") : "Отправить отчет";
                }

            } catch (error) {
                console.error("Submission error:", error);
                const errMsg = error && error.message ? error.message : "";
                if (errMsg.includes("Field value too long") || errMsg.includes("LIMIT_FIELD_VALUE")) {
                    showMessage(window.t ? window.t('errors.field_too_long', 'Значение поля слишком длинное.') : 'Значение поля слишком длинное.', "error");
                } else {
                    showMessage(window.t ? window.t('err_network_submit', 'Сетевой сбой при отправке формы. Попробуйте еще раз.') : 'Сетевой сбой при отправке формы. Попробуйте еще раз.', "error");
                }
                submitBtn.disabled = false;
                submitBtn.textContent = window.t ? (window.t('submit_report') || window.t('btn_submit_report') || "Отправить отчет") : "Отправить отчет";
            }
        });

        function showMessage(text, type) {
            messageBox.textContent = text;
            messageBox.className = `alert ${type}`;
            messageBox.style.display = "block";
        }
    }


    // -----------------------------------------------------
    // 6. МАГАЗИН И КУПОНЫ ПОЛЬЗОВАТЕЛЯ (Shop & Coupons)
    // -----------------------------------------------------
    function getLocalizedProp(obj, prop, defaultVal = '') {
        if (!obj) return defaultVal;
        const val = obj[prop];
        if (!val) return defaultVal;
        if (typeof val === 'string') return val;
        const lang = (window.i18n && typeof window.i18n.getCurrentLanguage === 'function') 
            ? window.i18n.getCurrentLanguage() 
            : 'ru';
        return val[lang] || val['ru'] || val['en'] || defaultVal;
    }

    const shopPartners = [
        {
            id: 'evos',
            name: { ru: 'EVOS', uz: 'EVOS', en: 'EVOS' },
            category: 'food',
            emoji: '🥙',
            tagline: {
                ru: 'Быстрое и вкусное эко-питание',
                uz: 'Tezkor va mazali eko-taomlar',
                en: 'Fast and tasty eco-food'
            },
            offers: [
                {
                    id: 'evos_10',
                    title: {
                        ru: 'Скидка 10% на чек (50k-100k сум)',
                        uz: '50k-100k so\'mlik chekka 10% chegirma',
                        en: '10% off receipt (50k-100k UZS)'
                    },
                    disclaimer: {
                        ru: '1 купон на 1 чек. Не суммируется.',
                        uz: '1 chek uchun 1 kupon. Boshqa aksiyalar bilan qo\'shilmaydi.',
                        en: '1 coupon per receipt. Non-stackable.'
                    },
                    price: 100,
                    partnerId: 'evos',
                    emoji: '🎟️'
                },
                {
                    id: 'evos_20',
                    title: {
                        ru: 'Скидка 20% на чек от 100k сум',
                        uz: '100k so\'mdan yuqori chekka 20% chegirma',
                        en: '20% off receipt over 100k UZS'
                    },
                    disclaimer: {
                        ru: '1 купон на 1 чек. Не суммируется.',
                        uz: '1 chek uchun 1 kupon. Boshqa aksiyalar bilan qo\'shilmaydi.',
                        en: '1 coupon per receipt. Non-stackable.'
                    },
                    price: 250,
                    partnerId: 'evos',
                    emoji: '🎁'
                }
            ]
        },
        {
            id: 'sofra',
            name: { ru: 'Sofra', uz: 'Sofra', en: 'Sofra' },
            category: 'food',
            emoji: '🍕',
            tagline: {
                ru: 'Восточная и европейская кухня',
                uz: 'Sharq va Yevropa taomlari',
                en: 'Eastern and European cuisine'
            },
            offers: [
                {
                    id: 'sofra_15',
                    title: {
                        ru: 'Скидка 15% на весь чек',
                        uz: 'Barcha chekka 15% chegirma',
                        en: '15% off total receipt'
                    },
                    disclaimer: {
                        ru: '1 купон на 1 чек. Не суммируется.',
                        uz: '1 chek uchun 1 kupon. Boshqa aksiyalar bilan qo\'shilmaydi.',
                        en: '1 coupon per receipt. Non-stackable.'
                    },
                    price: 150,
                    partnerId: 'sofra',
                    emoji: '🍕'
                },
                {
                    id: 'sofra_drink',
                    title: {
                        ru: 'Бесплатный напиток к комбо',
                        uz: 'Komboga bepul ichimlik',
                        en: 'Free beverage with any combo'
                    },
                    disclaimer: {
                        ru: '1 купон на 1 чек. Не суммируется.',
                        uz: '1 chek uchun 1 kupon. Boshqa aksiyalar билан qo\'shilmaydi.',
                        en: '1 coupon per receipt. Non-stackable.'
                    },
                    price: 80,
                    partnerId: 'sofra',
                    emoji: '🥤'
                }
            ]
        },
        {
            id: 'grand_lavash',
            name: { ru: 'Grand Lavash', uz: 'Grand Lavash', en: 'Grand Lavash' },
            category: 'food',
            emoji: '🌯',
            tagline: {
                ru: 'Сочные лаваши и гриль',
                uz: 'Sersuv lavashlar va grill',
                en: 'Juicy lavash and grill'
            },
            offers: [
                {
                    id: 'gl_10',
                    title: {
                        ru: 'Скидка 10% на любой лаваш',
                        uz: 'Har qanday lavashga 10% chegirma',
                        en: '10% off any lavash'
                    },
                    disclaimer: {
                        ru: '1 купон на 1 чек. Не суммируется.',
                        uz: '1 chek uchun 1 kupon. Boshqa aksiyalar bilan qo\'shilmaydi.',
                        en: '1 coupon per receipt. Non-stackable.'
                    },
                    price: 90,
                    partnerId: 'grand_lavash',
                    emoji: '🌯'
                }
            ]
        },
        {
            id: 'ecobook',
            name: { ru: 'EcoBook', uz: 'EcoBook', en: 'EcoBook' },
            category: 'education',
            emoji: '📚',
            tagline: {
                ru: 'Книги и эко-канцелярия',
                uz: 'Kitoblar va eko-kantselyariya',
                en: 'Books and eco-stationery'
            },
            offers: [
                {
                    id: 'eb_15',
                    title: {
                        ru: 'Скидка 15% на эко-литературу',
                        uz: 'Eko-adabiyotlarga 15% chegirma',
                        en: '15% off eco-literature'
                    },
                    disclaimer: {
                        ru: '1 купон на 1 чек. Не суммируется.',
                        uz: '1 chek uchun 1 kupon. Boshqa aksiyalar bilan qo\'shilmaydi.',
                        en: '1 coupon per receipt. Non-stackable.'
                    },
                    price: 120,
                    partnerId: 'ecobook',
                    emoji: '📚'
                },
                {
                    id: 'eb_30',
                    title: {
                        ru: 'Скидка 30% на абонемент читателя',
                        uz: 'Kitobxon obunasiga 30% chegirma',
                        en: '30% off monthly reading pass'
                    },
                    disclaimer: {
                        ru: '1 купон на 1 чек. Не суммируется.',
                        uz: '1 chek uchun 1 kupon. Boshqa aksiyalar bilan qo\'shilmaydi.',
                        en: '1 coupon per receipt. Non-stackable.'
                    },
                    price: 300,
                    partnerId: 'ecobook',
                    emoji: '🎟️'
                }
            ]
        },
        {
            id: 'city_gym',
            name: { ru: 'City Gym', uz: 'City Gym', en: 'City Gym' },
            category: 'sport',
            emoji: '🏋️‍♂️',
            tagline: {
                ru: 'Фитнес-центр и тренажерный зал',
                uz: 'Fitnes markazi va trenajyor zali',
                en: 'Fitness center & gym'
            },
            offers: [
                {
                    id: 'cg_20',
                    title: {
                        ru: 'Скидка 20% на месячный абонемент',
                        uz: 'Oylik obunaga 20% chegirma',
                        en: '20% off 1-month fitness pass'
                    },
                    disclaimer: {
                        ru: '1 купон на 1 чек. Не суммируется.',
                        uz: '1 chek uchun 1 kupon. Boshqa aksiyalar bilan qo\'shilmaydi.',
                        en: '1 coupon per receipt. Non-stackable.'
                    },
                    price: 400,
                    partnerId: 'city_gym',
                    emoji: '🏋️‍♂️'
                },
                {
                    id: 'cg_personal',
                    title: {
                        ru: '1 Бесплатная персональная тренировка',
                        uz: '1 ta bepul shaxsiy mashg\'ulot',
                        en: '1 free personal training session'
                    },
                    disclaimer: {
                        ru: '1 купон на 1 чек. Не суммируется.',
                        uz: '1 chek uchun 1 kupon. Boshqa aksiyalar bilan qo\'shilmaydi.',
                        en: '1 coupon per receipt. Non-stackable.'
                    },
                    price: 200,
                    partnerId: 'city_gym',
                    emoji: '💪'
                }
            ]
        },
        {
            id: 'eco_wear',
            name: { ru: 'EcoWear', uz: 'EcoWear', en: 'EcoWear' },
            category: 'clothing',
            emoji: '👕',
            tagline: {
                ru: 'Одежда из 100% органического хлопка',
                uz: '100% organik paxtadan kiyimlar',
                en: '100% organic cotton clothing'
            },
            offers: [
                {
                    id: 'ew_15',
                    title: {
                        ru: 'Скидка 15% на эко-футболки',
                        uz: 'Eko-futbolkalarga 15% chegirma',
                        en: '15% off eco t-shirts'
                    },
                    disclaimer: {
                        ru: '1 купон на 1 чек. Не суммируется.',
                        uz: '1 chek uchun 1 kupon. Boshqa aksiyalar bilan qo\'shilmaydi.',
                        en: '1 coupon per receipt. Non-stackable.'
                    },
                    price: 180,
                    partnerId: 'eco_wear',
                    emoji: '👕'
                }
            ]
        }
    ];

    let currentShopCategory = 'all';
    let currentActivePartner = null;
    let pendingPurchaseOffer = null;

    // Инициализация чипсов категорий
    const categoryChips = document.querySelectorAll('.shop-chip');
    categoryChips.forEach(chip => {
        chip.addEventListener('click', () => {
            categoryChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentShopCategory = chip.dataset.category || 'all';
            
            // Сбрасываем детальный просмотр и показываем сетку партнеров
            const offersWrapper = document.getElementById('shop-offers-container');
            const partnersGrid = document.getElementById('shop-partners-container');
            if (offersWrapper) offersWrapper.classList.add('hidden');
            if (partnersGrid) partnersGrid.classList.remove('hidden');
            
            renderShopPartners(currentShopCategory);
        });
    });

    // Отрисовка партнеров по категории
    function renderShopPartners(category = 'all') {
        const container = document.getElementById('shop-partners-container');
        if (!container) return;

        container.innerHTML = '';
        const filtered = category === 'all' 
            ? shopPartners 
            : shopPartners.filter(p => p.category === category);

        if (filtered.length === 0) {
            const emptyMsg = window.t ? window.t('empty_category_partners', 'Нет партнеров в этой категории') : 'Нет партнеров в этой категории';
            container.innerHTML = `<div class="history-placeholder">${emptyMsg}</div>`;
            return;
        }

        filtered.forEach(partner => {
            const card = document.createElement('div');
            card.className = 'partner-card';
            const offersText = partner.offers.length + " " + (window.t ? window.t('offers_count_suffix', 'предложений') : 'предложений');
            const nameStr = getLocalizedProp(partner, 'name');
            const taglineStr = getLocalizedProp(partner, 'tagline');
            card.innerHTML = `
                <div class="partner-icon">${partner.emoji}</div>
                <div class="partner-name">${nameStr}</div>
                <div class="partner-tag">${taglineStr}</div>
                <div class="partner-offers-count">${offersText}</div>
            `;
            card.addEventListener('click', () => {
                openPartnerOffers(partner);
            });
            container.appendChild(card);
        });
    }

    // Открытие списка предложений конкретного партнера
    function openPartnerOffers(partner) {
        currentActivePartner = partner;
        const partnersGrid = document.getElementById('shop-partners-container');
        const offersWrapper = document.getElementById('shop-offers-container');
        const headerInfo = document.getElementById('partner-header-info');

        if (partnersGrid) partnersGrid.classList.add('hidden');
        if (offersWrapper) offersWrapper.classList.remove('hidden');

        if (headerInfo) {
            const nameStr = getLocalizedProp(partner, 'name');
            const taglineStr = getLocalizedProp(partner, 'tagline');
            headerInfo.innerHTML = `
                <div style="font-size: 2.2rem;">${partner.emoji}</div>
                <div>
                    <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--eco-forest); margin-bottom: 2px;">${nameStr}</h3>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">${taglineStr}</p>
                </div>
            `;
        }

        renderPartnerOffers(partner);
    }

    // Кнопка Назад к партнерам
    const btnBackPartners = document.getElementById('btnBackToPartners');
    if (btnBackPartners) {
        btnBackPartners.addEventListener('click', () => {
            const partnersGrid = document.getElementById('shop-partners-container');
            const offersWrapper = document.getElementById('shop-offers-container');
            if (offersWrapper) offersWrapper.classList.add('hidden');
            if (partnersGrid) partnersGrid.classList.remove('hidden');
        });
    }

    // Отрисовка предложений партнера
    function renderPartnerOffers(partner) {
        const container = document.getElementById('shop-items-container');
        if (!container) return;

        container.innerHTML = '';
        const balance = getCoins();

        partner.offers.forEach(offer => {
            const isAffordable = balance >= offer.price;
            const itemCard = document.createElement('div');
            itemCard.className = `shop-item-card ${isAffordable ? '' : 'disabled'}`;

            const btnText = isAffordable 
                ? (window.t ? window.t('btn_get_reward', 'Получить') : 'Получить')
                : (window.t ? window.t('btn_not_enough_coins', 'Мало баллов') : 'Мало баллов');

            const titleStr = getLocalizedProp(offer, 'title');
            const disclaimerStr = getLocalizedProp(offer, 'disclaimer', window.t ? window.t('shop_terms_disclaimer', '1 купон на 1 чек. Не суммируется.') : '');

            itemCard.innerHTML = `
                <div class="shop-item-icon">${offer.emoji}</div>
                <div class="shop-item-info">
                    <h4>${titleStr}</h4>
                    <div class="offer-disclaimer">ℹ️ ${disclaimerStr}</div>
                    <div class="shop-item-footer">
                        <span class="shop-price">${offer.price} 🍃</span>
                        <button type="button" class="btn-buy-reward" data-id="${offer.id}">
                            ${btnText}
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(itemCard);

            const buyBtn = itemCard.querySelector('.btn-buy-reward');
            if (buyBtn) {
                buyBtn.addEventListener('click', () => {
                    triggerPurchaseFlow(offer, partner);
                });
            }
        });
    }

    // Совместимый оберточный метод
    function renderShopItems() {
        const partnersGrid = document.getElementById('shop-partners-container');
        const offersWrapper = document.getElementById('shop-offers-container');
        if (offersWrapper && !offersWrapper.classList.contains('hidden') && currentActivePartner) {
            renderPartnerOffers(currentActivePartner);
        } else {
            if (offersWrapper) offersWrapper.classList.add('hidden');
            if (partnersGrid) partnersGrid.classList.remove('hidden');
            renderShopPartners(currentShopCategory);
        }
    }

    // Модалка подтверждения покупки
    function triggerPurchaseFlow(offer, partner) {
        pendingPurchaseOffer = { offer, partner };
        const modal = document.getElementById('shop-confirm-modal');
        const descText = document.getElementById('shop-confirm-desc-text');
        const alertBox = document.getElementById('shop-confirm-alert');
        const balance = getCoins();

        if (alertBox) {
            alertBox.classList.add('hidden');
            alertBox.textContent = '';
        }

        if (descText) {
            const template = window.t ? window.t('shop_confirm_desc', 'Вы действительно хотите обменять {coins} эко-коинов на «{title}»?') : 'Вы действительно хотите обменять {coins} эко-коинов на «{title}»?';
            const offerTitleStr = getLocalizedProp(offer, 'title');
            descText.textContent = template.replace('{coins}', offer.price).replace('{title}', offerTitleStr);
        }

        if (balance < offer.price) {
            if (alertBox) {
                alertBox.textContent = window.t ? window.t('err_not_enough_coins', 'Недостаточно баллов на балансе!') : 'Недостаточно баллов на балансе!';
                alertBox.classList.remove('hidden');
            }
        }

        if (modal) modal.classList.remove('hidden');
    }

    const btnShopConfirmCancel = document.getElementById('btn-shop-confirm-cancel');
    const btnShopConfirmSubmit = document.getElementById('btn-shop-confirm-submit');
    const shopConfirmModal = document.getElementById('shop-confirm-modal');

    if (btnShopConfirmCancel && shopConfirmModal) {
        btnShopConfirmCancel.addEventListener('click', () => {
            shopConfirmModal.classList.add('hidden');
            pendingPurchaseOffer = null;
        });
    }

    if (btnShopConfirmSubmit && shopConfirmModal) {
        btnShopConfirmSubmit.addEventListener('click', () => {
            if (!pendingPurchaseOffer) return;
            const { offer, partner } = pendingPurchaseOffer;
            const balance = getCoins();

            if (balance < offer.price) {
                const alertBox = document.getElementById('shop-confirm-alert');
                if (alertBox) {
                    alertBox.textContent = window.t ? window.t('err_not_enough_coins', 'Недостаточно баллов на балансе!') : 'Недостаточно баллов на балансе!';
                    alertBox.classList.remove('hidden');
                }
                return;
            }

            // Списываем баллы
            addCoins(-offer.price);

            // Создаем купон со структурой локализации
            const partnerNameEn = getLocalizedProp(partner, 'name', 'EVOS');
            const codePrefix = partnerNameEn.toUpperCase().replace(/\s+/g, '').substring(0, 4);
            const randCode = "VS-" + codePrefix + "-" + Math.floor(1000 + Math.random() * 9000);
            
            const coupon = {
                id: 'coupon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                partnerName: partner.name, // object {ru, uz, en} or string
                partnerEmoji: partner.emoji,
                offerTitle: offer.title,   // object {ru, uz, en} or string
                disclaimer: offer.disclaimer, // object {ru, uz, en} or string
                code: randCode,
                purchasedAt: Date.now()
            };

            saveUserCoupon(coupon);
            shopConfirmModal.classList.add('hidden');
            pendingPurchaseOffer = null;

            // Показываем QR модалку
            const qrModal = document.getElementById('qr-modal');
            const qrName = document.getElementById('qr-coupon-item-name');
            const qrCode = document.getElementById('qr-coupon-code');
            if (qrModal && qrName && qrCode) {
                const pNameStr = getLocalizedProp(partner, 'name');
                const oTitleStr = getLocalizedProp(offer, 'title');
                qrName.textContent = `${pNameStr}: ${oTitleStr}`;
                qrCode.textContent = randCode;
                qrModal.classList.remove('hidden');
            }

            renderShopItems();
            renderMyCoupons();
        });
    }

    // Обработчик закрытия QR модалки
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');
    const qrModal = document.getElementById('qr-modal');
    if (closeQrModalBtn && qrModal) {
        closeQrModalBtn.addEventListener('click', () => {
            qrModal.classList.add('hidden');
            renderShopItems();
        });
    }

    // --- КУПОНЫ В ПРОФИЛЕ ---
    function getCouponsKey() {
        const user = getCurrentUsername() || 'guest';
        return `vaisperia_coupons_${user}`;
    }

    function getUserCoupons() {
        const raw = localStorage.getItem(getCouponsKey());
        if (!raw) return [];
        try {
            return JSON.parse(raw);
        } catch (e) {
            return [];
        }
    }

    function saveUserCoupon(coupon) {
        const coupons = getUserCoupons();
        coupons.unshift(coupon);
        localStorage.setItem(getCouponsKey(), JSON.stringify(coupons));
    }

    function removeUserCoupon(couponId) {
        const coupons = getUserCoupons();
        const updated = coupons.filter(c => c.id !== couponId);
        localStorage.setItem(getCouponsKey(), JSON.stringify(updated));
    }

    function renderMyCoupons() {
        const container = document.getElementById('my-coupons-container');
        const badge = document.getElementById('coupons-count-badge');
        if (!container) return;

        const coupons = getUserCoupons();
        if (badge) badge.textContent = coupons.length;

        if (coupons.length === 0) {
            const emptyText = window.t ? window.t('profile_coupons_empty', 'У вас пока нет купленных купонов. Выберите скидки в Магазине!') : 'У вас пока нет купленных купонов. Выберите скидки в Магазине!';
            container.innerHTML = `<div class="history-placeholder">${emptyText}</div>`;
            return;
        }

        container.innerHTML = '';
        const useBtnText = window.t ? window.t('btn_use_coupon', 'Использовать купон') : 'Использовать купон';
        const defaultDisclaimer = window.t ? window.t('shop_terms_disclaimer', '1 купон на 1 чек. Не суммируется.') : '1 купон на 1 чек. Не суммируется.';
        const qrInstructionText = window.t ? window.t('show_qr_instruction', 'Покажите QR-код кассиру:') : 'Покажите QR-код кассиру:';

        coupons.forEach(coupon => {
            const partnerNameStr = getLocalizedProp(coupon, 'partnerName', 'Partner');
            const offerTitleStr = getLocalizedProp(coupon, 'offerTitle', 'Offer');
            const disclaimerStr = getLocalizedProp(coupon, 'disclaimer', defaultDisclaimer);

            const card = document.createElement('div');
            card.className = 'coupon-card';
            card.innerHTML = `
                <div class="coupon-header">
                    <span class="coupon-partner"><span>${coupon.partnerEmoji || '🎁'}</span> ${partnerNameStr}</span>
                    <span class="coupon-code-tag">${coupon.code}</span>
                </div>
                <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">${offerTitleStr}</div>
                <div class="coupon-qr-box">
                    <svg class="coupon-qr-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100" height="100" rx="8" fill="#F8FAFC"/>
                        <rect x="10" y="10" width="25" height="25" fill="#0F5A3E"/>
                        <rect x="15" y="15" width="15" height="15" fill="#FFFFFF"/>
                        <rect x="18" y="18" width="9" height="9" fill="#10B981"/>
                        <rect x="65" y="10" width="25" height="25" fill="#0F5A3E"/>
                        <rect x="70" y="15" width="15" height="15" fill="#FFFFFF"/>
                        <rect x="73" y="18" width="9" height="9" fill="#10B981"/>
                        <rect x="10" y="65" width="25" height="25" fill="#0F5A3E"/>
                        <rect x="15" y="70" width="15" height="15" fill="#FFFFFF"/>
                        <rect x="18" y="73" width="9" height="9" fill="#10B981"/>
                        <rect x="42" y="10" width="16" height="8" fill="#10B981"/>
                        <rect x="42" y="24" width="8" height="16" fill="#0F5A3E"/>
                        <rect x="52" y="32" width="16" height="16" fill="#10B981"/>
                        <rect x="10" y="42" width="16" height="8" fill="#0F5A3E"/>
                        <rect x="74" y="42" width="16" height="16" fill="#10B981"/>
                        <rect x="42" y="65" width="16" height="25" fill="#0F5A3E"/>
                        <rect x="65" y="74" width="25" height="16" fill="#10B981"/>
                    </svg>
                    <div class="coupon-terms">
                        <strong>${qrInstructionText}</strong><br>
                        ${disclaimerStr}
                    </div>
                </div>
                <button type="button" class="btn-use-coupon" data-id="${coupon.id}">
                    ${useBtnText}
                </button>
            `;
            container.appendChild(card);

            const useBtn = card.querySelector('.btn-use-coupon');
            if (useBtn) {
                useBtn.addEventListener('click', () => {
                    removeUserCoupon(coupon.id);
                    const msgText = window.t ? window.t('msg_coupon_used', 'Купон успешно применен и погашен!') : 'Купон успешно применен и погашен!';
                    alert(msgText);
                    renderMyCoupons();
                });
            }
        });
    }

    // Слушатель смены языка в i18n
    if (window.i18n && typeof window.i18n.onLanguageChange === 'function') {
        window.i18n.onLanguageChange(() => {
            renderShopItems();
            renderMyCoupons();
        });
    }




    // -----------------------------------------------------
    // 7. ПРОФИЛЬ: УВЕДОМЛЕНИЯ И АЧИВКИ (Achievements & Timeline stats)
    // -----------------------------------------------------
    const achievementsList = [
        { key: "first_step", titleKey: "ach_first_step_title", descKey: "ach_first_step_desc", defaultTitle: "Первый росток", defaultDesc: "Успешно отправлен первый отчет", icon: "🌱", req: 1 },
        { key: "patrol", titleKey: "ach_patrol_title", descKey: "ach_patrol_desc", defaultTitle: "Защитник Нукуса", defaultDesc: "Зарегистрировано более 3 отчетов", icon: "🛡️", req: 3 },
        { key: "hero", titleKey: "ach_hero_title", descKey: "ach_hero_desc", defaultTitle: "Зеленый герой", defaultDesc: "Зарегистрировано более 5 отчетов", icon: "👑", req: 5 }
    ];

    function updateAchievements(reportsCount = 0) {
        const container = document.getElementById('achievements-container');
        if (!container) return;
        
        container.innerHTML = "";
        
        achievementsList.forEach(ach => {
            const isUnlocked = reportsCount >= ach.req;
            const card = document.createElement('div');
            card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
            
            const achTitle = window.t ? window.t(ach.titleKey, ach.defaultTitle) : ach.defaultTitle;
            const achDesc = window.t ? window.t(ach.descKey, ach.defaultDesc) : ach.defaultDesc;

            card.innerHTML = `
                <div class="ach-icon">${isUnlocked ? ach.icon : '🔒'}</div>
                <div class="ach-text">
                    <h5>${achTitle}</h5>
                    <p>${achDesc}</p>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function loadProfileHistory() {
        const listContainer = document.getElementById('profile-history-list');
        const countBadge = document.getElementById('profile-reports-count');
        if (!listContainer) return;

        const isGuest = (localStorage.getItem('vaisperia_isGuest') === 'true');
        const currentUsername = localStorage.getItem('vaisperia_username') || '';

        if (isGuest || !currentUsername) {
            if (countBadge) countBadge.textContent = '0';
            updateAchievements(0);
            const levelVal = document.getElementById('profile-level-val');
            const xpVal = document.getElementById('profile-xp-val');
            const xpFill = document.getElementById('profile-xp-fill');
            if (levelVal) levelVal.textContent = 1;
            if (xpVal) xpVal.textContent = 0;
            if (xpFill) xpFill.style.width = '0%';
            const guestMsg = window.t ? window.t('history_guest_placeholder', 'Вы вошли как Гость. Зарегистрируйтесь, чтобы копить баллы и видеть историю!') : 'Вы вошли как Гость. Зарегистрируйтесь, чтобы копить баллы и видеть историю!';
            listContainer.innerHTML = `<div class="history-placeholder">${guestMsg}</div>`;
            return;
        }

        fetch('/api/problems')
            .then(res => res.json())
            .then(data => {
                // Фильтруем личные отчеты текущего пользователя (включая созданные анонимно)
                const userProblems = data.filter(prob => prob.username === currentUsername || prob.user_id_name === currentUsername);

                // Обновляем личный счетчик
                if (countBadge) countBadge.textContent = userProblems.length;

                // Пересчитываем ачивки по личным отчетам
                updateAchievements(userProblems.length);

                // Рассчитываем личный уровень и XP
                const reportsCount = userProblems.length;
                const totalXP = reportsCount * 25;
                const level = Math.floor(totalXP / 100) + 1;
                const currentLevelXP = totalXP % 100;

                const levelVal = document.getElementById('profile-level-val');
                const xpVal = document.getElementById('profile-xp-val');
                const xpFill = document.getElementById('profile-xp-fill');

                if (levelVal) levelVal.textContent = level;
                if (xpVal) xpVal.textContent = currentLevelXP;
                if (xpFill) xpFill.style.width = currentLevelXP + '%';

                // Обновляем прогресс за месяц по личным отчетам
                updateMonthProgress(userProblems);

                if (userProblems.length === 0) {
                    const emptyMsg = window.t ? window.t('history_empty_placeholder', 'Вы пока не отправляли заявок. Вкладка "Карта" ждет вас!') : 'Вы пока не отправляли заявок. Вкладка "Карта" ждет вас!';
                    listContainer.innerHTML = `<div class="history-placeholder">${emptyMsg}</div>`;
                    return;
                }

                listContainer.innerHTML = "";

                userProblems.forEach(prob => {
                    const state = typeof getProblemState === 'function' ? getProblemState(prob) : { status: 'new', createdAt: Date.now() };
                    const dateStr = formatDateTashkent(state.createdAt);

                    let statusLabel = window.t ? window.t('status_new', 'Новая') : 'Новая';
                    if (state.status === 'in_progress') statusLabel = window.t ? window.t('status_in_progress', 'В обработке') : 'В обработке';
                    if (state.status === 'resolved') statusLabel = window.t ? window.t('status_resolved', 'Решена') : 'Решена';

                    const item = document.createElement('div');
                    item.className = 'history-item';

                    let imgHtml = "";
                    if (prob.photo_url) {
                        imgHtml = `<img src="${prob.photo_url}" alt="Фото заявки" class="history-item-img">`;
                    } else {
                        imgHtml = `<div class="history-item-noimg">📷</div>`;
                    }

                    item.innerHTML = `
                        ${imgHtml}
                        <div class="history-item-details">
                            <div class="history-item-header">
                                <span class="history-date">${dateStr}</span>
                                <span class="status-badge ${state.status}">${statusLabel}</span>
                            </div>
                            <p class="history-desc">${prob.description}</p>
                            <span class="history-coords">📍 ${parseFloat(prob.latitude).toFixed(5)}, ${parseFloat(prob.longitude).toFixed(5)}</span>
                        </div>
                    `;
                    listContainer.appendChild(item);
                });
            })
            .catch(err => {
                console.error("Error fetching operations history:", err);
                listContainer.innerHTML = `<div class="history-placeholder error">Ошибка связки с базой SQLite.</div>`;
            });
    }

    // -----------------------------------------------------
    // 8. TELEGRAM SETTINGS, NSFW CHECK & EMAIL PROTECTION
    // -----------------------------------------------------

    // Client-side NSFW & Safety Image Check
    function validateImageSafety(file) {
        return new Promise((resolve) => {
            if (!file || !file.type || !file.type.startsWith('image/')) {
                return resolve({ safe: false, reason: "Файл должен быть изображением (JPG, PNG, WEBP)." });
            }
            if (file.size > 5 * 1024 * 1024) {
                return resolve({ safe: false, reason: "Максимальный размер изображения — 5 МБ." });
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 100;
                    canvas.height = 100;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 100, 100);
                    
                    const imgData = ctx.getImageData(0, 0, 100, 100);
                    const pixels = imgData.data;
                    let skinPixels = 0;
                    let totalPixels = 100 * 100;

                    for (let i = 0; i < pixels.length; i += 4) {
                        const r = pixels[i];
                        const g = pixels[i + 1];
                        const b = pixels[i + 2];
                        
                        if (r > 95 && g > 40 && b > 20 && 
                            (Math.max(r, g, b) - Math.min(r, g, b) > 15) && 
                            Math.abs(r - g) > 15 && r > g && r > b) {
                            skinPixels++;
                        }
                    }

                    const skinRatio = skinPixels / totalPixels;
                    if (skinRatio > 0.65) {
                        return resolve({ 
                            safe: false, 
                            reason: "🛡️ Изображение отклонено фильтром безопасности Vaisperia (высокий уровень открытого контента / NSFW)." 
                        });
                    }

                    resolve({ safe: true, dataUrl: e.target.result });
                };
                img.onerror = () => resolve({ safe: false, reason: "Ошибка загрузки файла изображения." });
                img.src = e.target.result;
            };
            reader.onerror = () => resolve({ safe: false, reason: "Ошибка чтения файла." });
            reader.readAsDataURL(file);
        });
    }

    // Telegram-Style Settings Modal Logic
    const btnOpenSettingsGear = document.getElementById('btnOpenSettingsGear');
    const tgSettingsModal = document.getElementById('telegram-settings-modal');
    const closeTgSettingsBtn = document.getElementById('closeTgSettingsBtn');
    const settingUsernameInput = document.getElementById('setting-username-input');
    const settingEmailInput = document.getElementById('setting-email-input');
    const btnSaveUsername = document.getElementById('btnSaveUsername');
    const btnSaveEmail = document.getElementById('btnSaveEmail');
    const avatarFileInput = document.getElementById('avatar-file-input');
    const avatarErrorMsg = document.getElementById('avatar-error-msg');
    const btnClearCache = document.getElementById('btnClearCache');
    const btnTgLogout = document.getElementById('btnTgLogout');

    if (btnOpenSettingsGear && tgSettingsModal) {
        btnOpenSettingsGear.addEventListener('click', () => {
            const currentUsername = getCurrentUsername();
            if (settingUsernameInput) settingUsernameInput.value = currentUsername;
            if (settingEmailInput) settingEmailInput.value = localStorage.getItem(`vaisperia_email_${currentUsername}`) || 'user@gmail.com';
            updateProfileAvatarUI();
            tgSettingsModal.classList.remove('hidden');
        });
    }

    if (closeTgSettingsBtn && tgSettingsModal) {
        closeTgSettingsBtn.addEventListener('click', () => {
            tgSettingsModal.classList.add('hidden');
        });
    }

    if (btnSaveUsername) {
        btnSaveUsername.addEventListener('click', () => {
            const oldUsername = getCurrentUsername();
            const newName = settingUsernameInput ? settingUsernameInput.value.trim() : '';
            if (!newName) return alert("Введите имя пользователя.");

            if (oldUsername && oldUsername !== newName) {
                const avatar = localStorage.getItem(`vaisperia_avatar_${oldUsername}`);
                if (avatar) {
                    localStorage.setItem(`vaisperia_avatar_${newName}`, avatar);
                }
                const coins = localStorage.getItem(`vaisperia_balance_${oldUsername}`);
                if (coins !== null) {
                    localStorage.setItem(`vaisperia_balance_${newName}`, coins);
                }
                const email = localStorage.getItem(`vaisperia_email_${oldUsername}`);
                if (email) {
                    localStorage.setItem(`vaisperia_email_${newName}`, email);
                }
            }

            localStorage.setItem('vaisperia_username', newName);
            checkAuth();
            alert("Имя пользователя успешно обновлено!");
        });
    }

    // Avatar Upload Listener with NSFW check
    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', async () => {
            const file = avatarFileInput.files[0];
            if (!file) return;

            if (avatarErrorMsg) {
                avatarErrorMsg.classList.add('hidden');
                avatarErrorMsg.textContent = '';
            }

            const result = await validateImageSafety(file);
            if (!result.safe) {
                if (avatarErrorMsg) {
                    avatarErrorMsg.textContent = result.reason;
                    avatarErrorMsg.classList.remove('hidden');
                }
                avatarFileInput.value = '';
                return;
            }

            const username = getCurrentUsername();
            localStorage.setItem(`vaisperia_avatar_${username}`, result.dataUrl);
            updateProfileAvatarUI();
            alert(window.t ? window.t('msg_avatar_updated', 'Фото профиля успешно обновлено! 📸') : 'Фото профиля успешно обновлено! 📸');
        });
    }

    // Clear Cache & History Handler
    if (btnClearCache) {
        btnClearCache.addEventListener('click', () => {
            const confirmMsg = window.t ? window.t('confirm_clear_cache', 'Вы уверены, что хотите очистить локальную историю отчетов и кэш приложения?') : 'Вы уверены, что хотите очистить локальную историю отчетов и кэш приложения?';
            const confirmClear = confirm(confirmMsg);
            if (confirmClear) {
                for (let key in localStorage) {
                    if (key.startsWith('problemState_') || key.startsWith('vaisperia_dailyPoints_')) {
                        localStorage.removeItem(key);
                    }
                }
                alert(window.t ? window.t('msg_cache_cleared', 'История и кэш приложения успешно очищены!') : 'История и кэш приложения успешно очищены!');
                checkAuth();
            }
        });
    }

    if (btnTgLogout) {
        btnTgLogout.addEventListener('click', () => {
            if (tgSettingsModal) tgSettingsModal.classList.add('hidden');
            performLogout();
        });
    }

    // Protection for Changing Email in Settings
    let pendingNewEmail = '';
    const authConfirmModal = document.getElementById('auth-confirm-modal');
    const authConfirmPassword = document.getElementById('auth-confirm-password');
    const authConfirmError = document.getElementById('auth-confirm-error');
    const btnAuthConfirmCancel = document.getElementById('btn-auth-confirm-cancel');
    const btnAuthConfirmSubmit = document.getElementById('btn-auth-confirm-submit');

    if (btnSaveEmail) {
        btnSaveEmail.addEventListener('click', () => {
            const emailVal = settingEmailInput ? settingEmailInput.value.trim() : '';
            if (!emailVal || !emailVal.includes('@')) {
                return alert("Укажите корректный Gmail адрес.");
            }
            pendingNewEmail = emailVal;
            if (authConfirmPassword) authConfirmPassword.value = '';
            if (authConfirmError) {
                authConfirmError.classList.add('hidden');
                authConfirmError.textContent = '';
            }
            if (authConfirmModal) authConfirmModal.classList.remove('hidden');
        });
    }

    if (btnAuthConfirmCancel && authConfirmModal) {
        btnAuthConfirmCancel.addEventListener('click', () => {
            authConfirmModal.classList.add('hidden');
        });
    }

    if (btnAuthConfirmSubmit) {
        btnAuthConfirmSubmit.addEventListener('click', () => {
            const passVal = authConfirmPassword ? authConfirmPassword.value : '';
            if (!passVal) {
                if (authConfirmError) {
                    authConfirmError.textContent = "Введите текущий пароль для подтверждения безопасности.";
                    authConfirmError.classList.remove('hidden');
                }
                return;
            }

            const currentUsername = getCurrentUsername();
            localStorage.setItem(`vaisperia_email_${currentUsername}`, pendingNewEmail);
            if (authConfirmModal) authConfirmModal.classList.add('hidden');
            alert(`Email успешно обновлен на: ${pendingNewEmail}!`);
        });
    }

    // Forgot Password Modal Handlers
    const btnOpenForgotPassword = document.getElementById('btnOpenForgotPassword');
    const forgotModal = document.getElementById('forgot-password-modal');
    const btnForgotCancel = document.getElementById('btn-forgot-cancel');
    const btnForgotSubmit = document.getElementById('btn-forgot-submit');
    const forgotEmailInput = document.getElementById('forgot-email-input');
    const forgotMsg = document.getElementById('forgot-msg');

    if (btnOpenForgotPassword) {
        btnOpenForgotPassword.addEventListener('click', () => {
            if (forgotModal) {
                if (forgotEmailInput) forgotEmailInput.value = '';
                if (forgotMsg) {
                    forgotMsg.className = 'alert hidden';
                    forgotMsg.textContent = '';
                }
                forgotModal.classList.remove('hidden');
            }
        });
    }

    if (btnForgotCancel && forgotModal) {
        btnForgotCancel.addEventListener('click', () => {
            forgotModal.classList.add('hidden');
        });
    }

    if (btnForgotSubmit) {
        btnForgotSubmit.addEventListener('click', async () => {
            const emailVal = forgotEmailInput ? forgotEmailInput.value.trim() : '';
            if (!emailVal) {
                if (forgotMsg) {
                    forgotMsg.textContent = "Введите ваш Gmail адрес.";
                    forgotMsg.className = "alert error";
                }
                return;
            }

            try {
                btnForgotSubmit.disabled = true;
                btnForgotSubmit.textContent = "Отправка...";
                const res = await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailVal })
                });
                const data = await res.json();
                if (res.ok) {
                    if (forgotMsg) {
                        forgotMsg.textContent = data.message;
                        forgotMsg.className = "alert success";
                    }
                } else {
                    if (forgotMsg) {
                        forgotMsg.textContent = data.error || "Ошибка запроса восстановления.";
                        forgotMsg.className = "alert error";
                    }
                }
            } catch (err) {
                if (forgotMsg) {
                    forgotMsg.textContent = "Сетевой сбой при отправке запроса.";
                    forgotMsg.className = "alert error";
                }
            } finally {
                btnForgotSubmit.disabled = false;
                btnForgotSubmit.textContent = "Отправить";
            }
        });
    }

    // Подписка на автоматическую смену языка интерфейса
    if (window.i18n && window.i18n.onLanguageChange) {
        window.i18n.onLanguageChange(() => {
            checkAuth();
            renderShopItems();
            loadProfileHistory();
            if (window.updateMapUIElements) {
                window.updateMapUIElements();
            }
            const pInput = document.getElementById('photo');
            const pLabel = document.getElementById('photo-selected-name');
            const sBtn = document.getElementById('submitBtn');
            if (pInput && pLabel && pInput.files.length === 0) {
                pLabel.textContent = window.t ? (window.t('take_photo_onsite') || window.t('photo_dummy') || "Сделать снимок на месте") : "Сделать снимок на месте";
            }
            if (sBtn && !sBtn.disabled) {
                sBtn.textContent = window.t ? (window.t('submit_report') || window.t('btn_submit_report') || "Отправить отчет") : "Отправить отчет";
            }
        });
    }

    // Инициализация первой проверки авторизации
    checkAuth();
});
