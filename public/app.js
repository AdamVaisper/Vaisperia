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

    function checkAuth() {
        const isLoggedIn = (localStorage.getItem('vaisperia_isLoggedIn') === 'true' || localStorage.getItem('isAuth') === 'true');
        if (isLoggedIn) {
            stopWebcam();
            loginScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
            
            const username = localStorage.getItem('vaisperia_username') || 'Гражданин';
            const homeUserEl = document.getElementById('home-username');
            const profileUserTag = document.getElementById('profile-username-tag');
            
            if (homeUserEl) homeUserEl.textContent = username;
            if (profileUserTag) profileUserTag.textContent = username;

            const avatarSpan = document.querySelector('.avatar-circle span');
            if (avatarSpan && username) {
                avatarSpan.textContent = username.substring(0, 2).toUpperCase();
            }
            
            // Инициализация коинов
            initCoins();
            // Загрузка динамики
            loadProfileHistory();
            renderShopItems();
            
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

        const defaultOpts = {
            timeZone: 'Asia/Tashkent',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };

        return d.toLocaleString('ru-RU', Object.assign({}, defaultOpts, options));
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
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');

            if (!usernameInput || !usernameInput.value.trim() || !passwordInput || !passwordInput.value) {
                showBioError("Заполните никнейм и пароль.");
                return;
            }

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

    // Сканирование биометрии и отправка на POST /api/register
    if (btnSubmitBiometrics) {
        btnSubmitBiometrics.addEventListener('click', async () => {
            hideBioError();
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');

            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';

            if (!username || !password) {
                showBioError("Пожалуйста, заполните никнейм и пароль на Шаге 1.");
                return;
            }

            btnSubmitBiometrics.disabled = true;
            btnSubmitBiometrics.textContent = "Сканирование и проверка...";

            const faceVector = captureFaceVector();

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, faceVector })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('vaisperia_isLoggedIn', 'true');
                    localStorage.setItem('isAuth', 'true');
                    localStorage.setItem('vaisperia_username', username);
                    stopWebcam();
                    btnSubmitBiometrics.disabled = false;
                    btnSubmitBiometrics.textContent = "Пройти биометрию 🗸";
                    checkAuth();
                } else {
                    showBioError(data.error || "Ошибка биометрической регистрации.");
                    btnSubmitBiometrics.disabled = false;
                    btnSubmitBiometrics.textContent = "Пройти биометрию 🗸";
                }
            } catch (err) {
                console.error("Biometric registration error:", err);
                showBioError("Ошибка соединения с сервером.");
                btnSubmitBiometrics.disabled = false;
                btnSubmitBiometrics.textContent = "Пройти биометрию 🗸";
            }
        });
    }

    function performLogout() {
        localStorage.removeItem('vaisperia_isLoggedIn');
        localStorage.removeItem('isAuth');
        localStorage.removeItem('vaisperia_username');
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
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let count = 0;
        problems.forEach(prob => {
            let state = typeof window.getProblemState === 'function' ? window.getProblemState(prob) : { createdAt: Date.now() };
            const created = new Date(state.createdAt);
            if (created.getMonth() === currentMonth && created.getFullYear() === currentYear) {
                count++;
            }
        });
        
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
            
            // При открытии профиля обновляем информацию
            if (targetTab === 'profile') {
                loadProfileHistory();
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
                    <button onclick="event.stopPropagation(); window.confirmLocationSelect(${lat}, ${lng});" class="btn-resolve" style="background: #10b981; margin: 0; width: 100%;">Выбрать эту точку</button>
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
        statsBtn.id = 'stats-btn';
        statsBtn.textContent = 'Статистика';
        mapElement.appendChild(statsBtn);
        L.DomEvent.disableClickPropagation(statsBtn);

        // Кнопка тепловой карты
        const hotzonesBtn = document.createElement('button');
        hotzonesBtn.id = 'hotzones-btn';
        hotzonesBtn.textContent = '🔥 Зоны скопления';
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
        statsPanel.innerHTML = `
            <div class="stats-header">
                <h3>Статистика города</h3>
                <button id="stats-close">&times;</button>
            </div>
            <div class="stats-body">
                <div class="stat-block">
                    <div class="stat-title">🚨 Итоги работы</div>
                    <div class="stat-row"><span>Среднее время решения</span><span class="stat-number" id="stat-avg-res-time">N/A</span></div>
                    <div class="stat-row"><span>Покрытие зон</span><span class="stat-number" id="stat-high-density" style="font-size: 0.8rem">Анализ...</span></div>
                </div>
                <div class="stat-block">
                    <div class="stat-title">📅 За сегодня</div>
                    <div class="stat-row"><span><span class="color-dot red"></span>Новые заявки</span><span class="stat-number" id="stat-today-new">0</span></div>
                    <div class="stat-row"><span><span class="color-dot green"></span>Решенные</span><span class="stat-number" id="stat-today-res">0</span></div>
                </div>
                <div class="stat-block">
                    <div class="stat-title">📊 В работе</div>
                    <div class="stat-row"><span><span class="color-dot yellow"></span>Количество</span><span class="stat-number" id="stat-curr-prog">0</span></div>
                </div>
                <div class="stat-block">
                    <div class="stat-title">📆 За месяц</div>
                    <div class="stat-row"><span>Новые за месяц</span><span class="stat-number" id="stat-month-new">0</span></div>
                    <div class="stat-row"><span>Решенные</span><span class="stat-number" id="stat-month-res">0</span></div>
                </div>
                <div class="stat-block">
                    <div class="stat-title">📈 За год</div>
                    <div class="stat-row"><span>Новые за год</span><span class="stat-number" id="stat-year-new">0</span></div>
                    <div class="stat-row"><span>Решенные</span><span class="stat-number" id="stat-year-res">0</span></div>
                </div>
            </div>
        `;
        mapElement.appendChild(statsPanel);

        // Фильтры карты
        const filtersContainer = document.createElement('div');
        filtersContainer.id = 'map-filters';
        filtersContainer.innerHTML = `
            <button class="filter-btn active" data-filter="all">Все</button>
            <button class="filter-btn" data-filter="new">Новые</button>
            <button class="filter-btn" data-filter="in_progress">В работе</button>
            <button class="filter-btn" data-filter="resolved">Решенные</button>
        `;
        mapElement.appendChild(filtersContainer);
        L.DomEvent.disableClickPropagation(filtersContainer);
        L.DomEvent.disableClickPropagation(statsPanel);

        statsBtn.addEventListener('click', (e) => {
            if (e) e.stopPropagation();
            statsPanel.style.display = 'flex';
            statsBtn.style.display = 'none';
        });

        document.getElementById('stats-close').addEventListener('click', (e) => {
            if (e) e.stopPropagation();
            statsPanel.style.display = 'none';
            statsBtn.style.display = 'block';
        });

        // Локальное управление состояниями
        const getProblemState = (problem) => {
            const saved = localStorage.getItem('problemState_' + problem.id);
            if (saved) return JSON.parse(saved);
            
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

            return {
                status: 'new',
                createdAt: timeMs,
                resolvedAt: null
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

        const updateStatsUI = () => {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const currentDate = now.getDate();

            let stats = { todayNew: 0, todayResolved: 0, currentInProgress: 0, monthNew: 0, monthResolved: 0, yearNew: 0, yearResolved: 0 };
            
            let totalResolutionMs = 0;
            let resolvedWithDatesCount = 0;
            let areaGridCounts = {};

            allMarkersData.forEach(item => {
                const state = item.state;
                const created = new Date(state.createdAt);

                const latKey = item.problem.latitude.toFixed(2);
                const lngKey = item.problem.longitude.toFixed(2);
                const gridKey = latKey + ',' + lngKey;
                areaGridCounts[gridKey] = (areaGridCounts[gridKey] || 0) + 1;

                if (state.status === 'resolved' && state.resolvedAt) {
                    totalResolutionMs += (state.resolvedAt - state.createdAt);
                    resolvedWithDatesCount++;
                }

                if (created.getFullYear() === currentYear) {
                    stats.yearNew++;
                    if (created.getMonth() === currentMonth) {
                        stats.monthNew++;
                        if (created.getDate() === currentDate) {
                            stats.todayNew++;
                        }
                    }
                }

                if (state.status === 'in_progress') {
                    stats.currentInProgress++;
                }

                if (state.status === 'resolved' && state.resolvedAt) {
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
            if (resolvedWithDatesCount > 0) {
                const avgMs = totalResolutionMs / resolvedWithDatesCount;
                const avgHours = avgMs / (1000 * 60 * 60);
                let avgStr = "";
                if (avgHours < 24) {
                    avgStr = Math.max(1, Math.round(avgHours)) + " ч.";
                } else {
                    avgStr = Math.round(avgHours / 24) + " дн.";
                }
                document.getElementById('stat-avg-res-time').textContent = avgStr;
            } else {
                document.getElementById('stat-avg-res-time').textContent = "N/A";
            }

            // Выявление зон большой скопленности
            let highestDensity = 0;
            for (const key in areaGridCounts) {
                if (areaGridCounts[key] > highestDensity) {
                    highestDensity = areaGridCounts[key];
                }
            }
            if (highestDensity >= 3) {
                 document.getElementById('stat-high-density').textContent = "Множеств. очаги";
            } else if (highestDensity > 0) {
                 document.getElementById('stat-high-density').textContent = "Рассеянные случаи";
            } else {
                 document.getElementById('stat-high-density').textContent = "Нет данных";
            }

            document.getElementById('stat-today-new').textContent = stats.todayNew;
            document.getElementById('stat-today-res').textContent = stats.todayResolved;
            document.getElementById('stat-curr-prog').textContent = stats.currentInProgress;
            document.getElementById('stat-month-new').textContent = stats.monthNew;
            document.getElementById('stat-month-res').textContent = stats.monthResolved;
            document.getElementById('stat-year-new').textContent = stats.yearNew;
            document.getElementById('stat-year-res').textContent = stats.yearResolved;
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

        // Генерация всплывающего окна
        const getPopupContent = (problem, state) => {
            let html = `<div class="popup-container">`;
            if (problem.photo_url) {
                html += `<img src="${problem.photo_url}" class="popup-img" alt="Problem photo">`;
            }
            html += `<div class="popup-details"><strong>Описание:</strong> ${problem.description}</div>`;
            
            let statusLabel = state.status === 'new' ? 'Новая' : (state.status === 'in_progress' ? 'В обработке' : 'Решена');
            html += `
                <div class="popup-meta">
                    <div>Статус: <span class="status-badge ${state.status}">${statusLabel}</span></div>
                    <div>Создана: ${formatDateTashkent(state.createdAt)}</div>
            `;
            
            if (state.status === 'resolved' && state.resolvedAt) {
                 html += `<div>Решена: ${formatDateTashkent(state.resolvedAt)}</div>`;
            }
            html += `</div>`;

            if (state.status !== 'resolved') {
                 html += `<button class="btn-resolve" onclick="markProblemResolved(${problem.id})">Отметить как решенную</button>`;
            }
            html += `</div>`;
            return html;
        };

        function openBottomSheet(problem, state) {
            let sheet = document.getElementById('report-bottom-sheet');
            if (!sheet) {
                sheet = document.createElement('div');
                sheet.id = 'report-bottom-sheet';
                sheet.className = 'report-bottom-sheet hidden';
                sheet.innerHTML = `
                    <button class="bottom-sheet-close" id="bottomSheetCloseBtn">&times;</button>
                    <div class="bottom-sheet-content" id="bottomSheetContent"></div>
                `;
                mapElement.appendChild(sheet);
                L.DomEvent.disableClickPropagation(sheet);
                
                sheet.querySelector('#bottomSheetCloseBtn').addEventListener('click', (e) => {
                    if (e) e.stopPropagation();
                    closeBottomSheet();
                });
            }

            const contentContainer = sheet.querySelector('#bottomSheetContent');
            let statusLabel = state.status === 'new' ? 'Новая' : (state.status === 'in_progress' ? 'В обработке' : 'Решена');
            let dateStr = formatDateTashkent(state.createdAt);

            let imgHtml = "";
            if (problem.photo_url) {
                imgHtml = `<img src="${problem.photo_url}" class="sheet-img" alt="Фото проблемы">`;
            } else {
                imgHtml = `<div class="sheet-no-img">📷 Фотография отсутствует</div>`;
            }

            let html = `
                ${imgHtml}
                <div class="sheet-details">
                    <div class="sheet-header">
                        <span class="status-badge ${state.status}">${statusLabel}</span>
                        <span class="sheet-date">📅 ${dateStr}</span>
                    </div>
                    <p class="sheet-desc"><strong>Описание:</strong> ${problem.description}</p>
            `;

            if (state.status === 'resolved' && state.resolvedAt) {
                html += `<div class="sheet-resolved-date">Решено: ${formatDateTashkent(state.resolvedAt)}</div>`;
            }

            if (state.status !== 'resolved') {
                html += `<button class="btn-resolve sheet-btn-resolve" onclick="markProblemResolved(${problem.id})">Отметить как решенную</button>`;
            }

            html += `</div>`;

            contentContainer.innerHTML = html;
            sheet.classList.remove('hidden');
            sheet.classList.add('active');
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
            if (!item) return;

            item.state.status = 'resolved';
            item.state.resolvedAt = Date.now();
            saveProblemState(item.problem.id, item.state);
            
            item.marker.setIcon(icons['resolved']);
            updateStatsUI();
            applyFilter();
            updateHeatmap();
            
            openBottomSheet(item.problem, item.state);
            loadProfileHistory();
        };

        // Запрос всех заявок и построение меток
        function fetchProblemsAndDraw() {
            // Очищаем старые метки с карты
            allMarkersData.forEach(item => {
                map.removeLayer(item.marker);
            });
            allMarkersData.length = 0;

            fetch('/api/problems')
                .then(response => response.json())
                .then(data => {
                    const now = Date.now();

                    data.forEach(problem => {
                        let state = getProblemState(problem);
                        let stateChanged = false;

                        // Правило жизненного цикла: переход в работу на след. календарные сутки
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
                            icon: icons[state.status]
                        });

                        marker.on('click', (e) => {
                            if (e && e.originalEvent) e.originalEvent.stopPropagation();
                            map.panTo([problem.latitude, problem.longitude], { animate: true });
                            openBottomSheet(problem, state);
                        });
                        marker.addTo(map);

                        allMarkersData.push({ problem, state, marker });
                    });

                    updateStatsUI();
                    updateHeatmap();
                    updateMonthProgress(data);
                })
                .catch(error => console.error("Error fetching problems:", error));
        }

        fetchProblemsAndDraw();
        window.fetchProblemsAndDraw = fetchProblemsAndDraw; // Оставляем для триггера обновления
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
        
        // Плитки категорий события
        const categoryTiles = document.querySelectorAll('.category-tile');
        const categoryInput = document.getElementById('report-category');
        if (categoryTiles && categoryInput) {
            categoryTiles.forEach(tile => {
                tile.addEventListener('click', () => {
                    categoryTiles.forEach(t => t.classList.remove('selected'));
                    tile.classList.add('selected');
                    categoryInput.value = tile.dataset.value;
                });
            });
        }
        
        // Индикация выбранного файла
        if (photoInput && photoLabel) {
            photoInput.addEventListener('change', () => {
                if (photoInput.files.length > 0) {
                    photoLabel.textContent = photoInput.files[0].name;
                } else {
                    photoLabel.textContent = "Сделать снимок на месте";
                }
            });
        }

        const savedLat = localStorage.getItem('selectedLat');
        const savedLng = localStorage.getItem('selectedLng');

        // Автоопределение локации
        if (savedLat && savedLng) {
            latInput.value = parseFloat(savedLat).toFixed(6);
            lngInput.value = parseFloat(savedLng).toFixed(6);
            locStatus.textContent = "Координаты загружены с карты ✓";
            locStatus.style.color = "green";
            submitBtn.disabled = false;
            
            localStorage.removeItem('selectedLat');
            localStorage.removeItem('selectedLng');
        } else if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    latInput.value = position.coords.latitude.toFixed(6);
                    lngInput.value = position.coords.longitude.toFixed(6);
                    locStatus.textContent = "Геопозиция определена успешно ✓";
                    locStatus.style.color = "green";
                    submitBtn.disabled = false;
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    locStatus.textContent = "Отклонено. Укажите координаты на карте.";
                    locStatus.style.color = "red";
                    submitBtn.disabled = false; // Включаем кнопку для ручного ввода
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            locStatus.textContent = "Браузер не поддерживает автоопределение.";
            locStatus.style.color = "red";
            submitBtn.disabled = false;
        }

        latInput.addEventListener('input', () => { submitBtn.disabled = false; });
        lngInput.addEventListener('input', () => { submitBtn.disabled = false; });

        // Отправка формы через Multipart
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            messageBox.className = "alert";
            messageBox.textContent = "";
            messageBox.style.display = "none";

            const file = photoInput.files[0];
            
            // Клиентская валидация размера файла (5 МБ)
            if (file && file.size > 5 * 1024 * 1024) {
                showMessage("Размер файла не должен превышать 5 МБ.", "error");
                return;
            }

            const formData = new FormData(reportForm);
            formData.append('username', localStorage.getItem('vaisperia_username') || 'Adam_Vaisper');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = "Отправка...";

                const response = await fetch('/api/problems', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    // НАЧИСЛЕНИЕ БАЛЛОВ (динамическое с дневным лимитом 100)
                    const daily = getDailyPoints();
                    let coinsToAdd = 0;
                    
                    if (daily >= 100) {
                        showMessage("Отчет успешно создан! Вы превысили дневной лимит в 100 баллов, новые коины не начислены.", "success");
                    } else {
                        const descText = document.getElementById('description').value.trim();
                        // Точное заполнение: длина описания от 30 символов дает 10 коинов, иначе 5
                        if (descText.length >= 30) {
                            coinsToAdd = 10;
                        } else {
                            coinsToAdd = 5;
                        }
                        
                        // Capping points at daily limit
                        const remaining = 100 - daily;
                        if (coinsToAdd > remaining) {
                            coinsToAdd = remaining;
                        }
                        
                        if (coinsToAdd > 0) {
                            addCoins(coinsToAdd);
                            addDailyPoints(coinsToAdd);
                            showMessage(`Отчет успешно создан! Начислено +${coinsToAdd} эко-коинов 🍃`, "success");
                        } else {
                            showMessage("Отчет успешно создан!", "success");
                        }
                    }

                    // Очистка формы
                    reportForm.reset();
                    if (photoLabel) {
                        photoLabel.textContent = "Сделать снимок на месте";
                    }
                    if (categoryTiles && categoryInput) {
                        categoryTiles.forEach(t => t.classList.remove('selected'));
                        const defaultTile = document.querySelector('.category-tile[data-value="Дороги"]');
                        if (defaultTile) defaultTile.classList.add('selected');
                        categoryInput.value = "Дороги";
                    }

                    // Обновляем карту в фоне
                    if (window.fetchProblemsAndDraw) {
                        window.fetchProblemsAndDraw();
                    }

                    // Переключаем на карту через 2 секунды
                    setTimeout(() => {
                        messageBox.style.display = "none";
                        submitBtn.disabled = false;
                        submitBtn.textContent = "Отправить отчет";
                        
                        const mapTab = document.querySelector('.nav-tab[data-tab="map"]');
                        if (mapTab) {
                            mapTab.click();
                        }
                    }, 2000);

                } else {
                    showMessage(data.error || "Неизвестная ошибка сервера.", "error");
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Отправить отчет";
                }

            } catch (error) {
                console.error("Submission error:", error);
                showMessage("Сетевой сбой при отправке формы. Попробуйте еще раз.", "error");
                submitBtn.disabled = false;
                submitBtn.textContent = "Отправить отчет";
            }
        });

        function showMessage(text, type) {
            messageBox.textContent = text;
            messageBox.className = `alert ${type}`;
            messageBox.style.display = "block";
        }
    }


    // -----------------------------------------------------
    // 6. МАГАЗИН ЭКО-НАГРАД (Rewards shop logic)
    // -----------------------------------------------------
    const rewardProducts = [
        { id: 1, name: "Купон: Скидка 10%", price: 100, description: "Скидка 10% на любые чеки до 50 000 сум у партнеров.", emoji: "🎟️" },
        { id: 2, name: "Купон: Скидка 25%", price: 400, description: "Скидка 25% на любые чеки до 50 000 сум у партнеров.", emoji: "🎁" },
        { id: 3, name: "Купон: Скидка 50%", price: 1000, description: "Скидка 50% на любые чеки до 50 000 сум у партнеров.", emoji: "🔥" }
    ];

    function renderShopItems() {
        const container = document.getElementById('shop-items-container');
        if (!container) return;
        
        container.innerHTML = "";
        const balance = getCoins();
        
        rewardProducts.forEach(prod => {
            const isAffordable = balance >= prod.price;
            const itemCard = document.createElement('div');
            itemCard.className = `shop-item-card ${isAffordable ? '' : 'disabled'}`;
            
            itemCard.innerHTML = `
                <div class="shop-item-icon">${prod.emoji}</div>
                <div class="shop-item-info">
                    <h4>${prod.name}</h4>
                    <p class="shop-item-desc">${prod.description}</p>
                    <div class="shop-item-footer">
                        <span class="shop-price">${prod.price} 🍃</span>
                        <button class="btn-buy-reward" data-id="${prod.id}" ${isAffordable ? '' : 'disabled'}>
                            ${isAffordable ? 'Получить' : 'Мало баллов'}
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(itemCard);
        });
        
        container.querySelectorAll('.btn-buy-reward').forEach(btn => {
            btn.addEventListener('click', () => {
                const prodId = parseInt(btn.dataset.id, 10);
                const product = rewardProducts.find(p => p.id === prodId);
                if (product) {
                    purchaseReward(product);
                }
            });
        });
    }

    function purchaseReward(product) {
        const balance = getCoins();
        if (balance < product.price) {
            alert("Недостаточно баллов на балансе!");
            return;
        }
        
        // Списываем
        const remaining = balance - product.price;
        localStorage.setItem('vaisperia_balance', remaining);
        updateCoinsUI();
        
        // Показываем QR код
        const modal = document.getElementById('qr-modal');
        const modalName = document.getElementById('qr-coupon-item-name');
        const modalCode = document.getElementById('qr-coupon-code');
        
        if (modal && modalName && modalCode) {
            modalName.textContent = product.name;
            const randCode = "VS-" + Math.floor(1000 + Math.random() * 9000) + "-" + Math.floor(1000 + Math.random() * 9000);
            modalCode.textContent = randCode;
            modal.classList.remove('hidden');
        }
    }

    // Обработчик закрытия модалки
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');
    const qrModal = document.getElementById('qr-modal');
    if (closeQrModalBtn && qrModal) {
        closeQrModalBtn.addEventListener('click', () => {
            qrModal.classList.add('hidden');
            renderShopItems(); // Перерендерим товары
        });
    }


    // -----------------------------------------------------
    // 7. ПРОФИЛЬ: УВЕДОМЛЕНИЯ И АЧИВКИ (Achievements & Timeline stats)
    // -----------------------------------------------------
    const achievementsList = [
        { key: "first_step", title: "Первый росток", desc: "Успешно отправлен первый отчет", icon: "🌱", req: 1 },
        { key: "patrol", title: "Защитник Нукуса", desc: "Зарегистрировано более 3 отчетов", icon: "🛡️", req: 3 },
        { key: "hero", title: "Зеленый герой", desc: "Зарегистрировано более 5 отчетов", icon: "👑", req: 5 }
    ];

    function updateAchievements(reportsCount = 0) {
        const container = document.getElementById('achievements-container');
        if (!container) return;
        
        container.innerHTML = "";
        
        achievementsList.forEach(ach => {
            const isUnlocked = reportsCount >= ach.req;
            const card = document.createElement('div');
            card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
            
            card.innerHTML = `
                <div class="ach-icon">${isUnlocked ? ach.icon : '🔒'}</div>
                <div class="ach-text">
                    <h5>${ach.title}</h5>
                    <p>${ach.desc}</p>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function loadProfileHistory() {
        const listContainer = document.getElementById('profile-history-list');
        const countBadge = document.getElementById('profile-reports-count');
        if (!listContainer) return;

        fetch('/api/problems')
            .then(res => res.json())
            .then(data => {
                const currentUsername = localStorage.getItem('vaisperia_username') || '';
                
                // Фильтруем ТОЛЬКО личные отчеты текущего пользователя для вкладки Профиль
                const userProblems = data.filter(prob => prob.username === currentUsername);

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
                    listContainer.innerHTML = `<div class="history-placeholder">Вы пока не отправляли заявок. Вкладка "Карта" ждет вас!</div>`;
                    return;
                }

                listContainer.innerHTML = "";

                userProblems.forEach(prob => {
                    const state = typeof getProblemState === 'function' ? getProblemState(prob) : { status: 'new', createdAt: Date.now() };
                    const dateStr = formatDateTashkent(state.createdAt);

                    let statusLabel = 'Новая';
                    if (state.status === 'in_progress') statusLabel = 'В обработке';
                    if (state.status === 'resolved') statusLabel = 'Решена';

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

    // Инициализация первой проверки авторизации
    checkAuth();
});
