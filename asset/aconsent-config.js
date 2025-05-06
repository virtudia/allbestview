(function () {
  // Fungsi untuk mendapatkan nilai cookie
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  // Fungsi untuk memperbarui Google Consent Mode
  function updateConsentMode(choices) {
    window.gtag = window.gtag || function() { (window.dataLayer = window.dataLayer || []).push(arguments); };
    const consentConfig = {
      analytics_storage: choices.analytical ? 'granted' : 'denied',
      ad_storage: choices.advertising ? 'granted' : 'denied',
      ad_user_data: choices.advertising ? 'granted' : 'denied',
      ad_personalization: choices.advertising ? 'granted' : 'denied'
    };
    gtag('consent', 'update', consentConfig);
    console.debug('Google Consent Mode diperbarui:', consentConfig);
  }



function saveConsentChoices(choices) {
  const bannerSuffix = window.aCBm?.cookieBanner?.getBannerSuffix() || '';
  Object.entries(choices).forEach(([key, value]) => {
    localStorage.setItem(`bestviewcc_${key}${bannerSuffix}`, value.toString());
  });
  localStorage.setItem(`cookie_consent${bannerSuffix}`, JSON.stringify(choices)); // Simpan cookie_consent di localStorage
  console.debug('Menyimpan pilihan consent:', choices, 'dengan suffix:', bannerSuffix);
  updateConsentMode(choices);
  fetch('https://www.allbestview.com/set-consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      necessary: choices.necessary,
      analytical: choices.analytical,
      advertising: choices.advertising
    }),
    credentials: 'include'
  })
    .then(response => response.json())
    .then(data => {
      console.debug('Consent berhasil dikirim ke server:', data);
    })
    .catch(error => {
      console.error('Error mengirim consent ke server:', error);
    });
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'consent_updated',
    consent_necessary: true,
    consent_analytical: choices.analytical === true,
    consent_advertising: choices.advertising === true
  });
}


  // Fungsi untuk menerapkan pilihan consent
  function applyConsentChoices(choices) {
    const cookieTypes = window.aCBm?.cookieBanner?.config?.cookieTypes || [];
    cookieTypes.forEach(type => {
      const accepted = choices[type.id];
      if (accepted && typeof type.onAccept === 'function') {
        try {
          type.onAccept();
          console.debug(`onAccept dipanggil untuk ${type.id}`);
        } catch (e) {
          console.warn(`Error menjalankan onAccept untuk ${type.id}:`, e);
        }
      } else if (!accepted && typeof type.onReject === 'function') {
        try {
          type.onReject();
          console.debug(`onReject dipanggil untuk ${type.id}`);
        } catch (e) {
          console.warn(`Error menjalankan onReject untuk ${type.id}:`, e);
        }
      }
    });
    console.debug('Pilihan consent diterapkan:', choices);
  }


function syncConsentFromCookie() {
  const bannerSuffix = window.aCBm?.cookieBanner?.getBannerSuffix() || '';
  const cookieConsent = localStorage.getItem(`cookie_consent${bannerSuffix}`);
  if (cookieConsent) {
    try {
      const consent = JSON.parse(cookieConsent);
      localStorage.setItem(`bestviewcc_necessary${bannerSuffix}`, 'true');
      localStorage.setItem(`bestviewcc_analytical${bannerSuffix}`, consent.analytical ? 'true' : 'false');
      localStorage.setItem(`bestviewcc_advertising${bannerSuffix}`, consent.advertising ? 'true' : 'false');
      updateConsentMode(consent);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'consent_synced_from_cookie',
        consent_necessary: true,
        consent_analytical: consent.analytical === true,
        consent_advertising: consent.advertising === true
      });
      console.debug('Consent disinkronkan dari localStorage:', consent);
    } catch (error) {
      console.error('Error parsing cookie_consent:', error);
    }
  }
}




  // Dengarkan event consent_updated dan consent_given
  document.addEventListener('consent_updated', (e) => {
    const choices = e.detail;
    saveConsentChoices(choices);
    applyConsentChoices(choices);
  });

  document.addEventListener('consent_given', (e) => {
    const choices = e.detail;
    saveConsentChoices(choices);
    applyConsentChoices(choices);
  });

  // Inisialisasi Silktide Cookie Consent Manager
  (function waitForConsentManagerAndGtag() {
    if (
      window.aCBm?.updateCookieBannerConfig &&
      window.gtag
    ) {
      // Sinkronkan consent dari cookie saat inisialisasi
      syncConsentFromCookie();

      window.aCBm.updateCookieBannerConfig({
        onClickAccept: () => {
          console.debug('Accept all diklik');
        },
        onClickReject: () => {
          console.debug('Reject non-essential diklik');
        },
        onClickPreferences: () => {
          console.debug('Modal preferensi dibuka');
        },
        onConsentGiven: () => {
          console.debug('Consent diberikan');
          const bannerSuffix = window.aCBm?.cookieBanner?.getBannerSuffix() || '';
          const consentNecessary = true;
          const consentAnalytical = localStorage.getItem(`bestviewcc_analytical${bannerSuffix}`) === 'true';
          const consentAdvertising = localStorage.getItem(`bestviewcc_advertising${bannerSuffix}`) === 'true';
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: 'consent_given',
            consent_necessary: consentNecessary,
            consent_analytical: consentAnalytical,
            consent_advertising: consentAdvertising
          });
          console.debug('Consent granular pushed:', {
            consent_necessary: consentNecessary,
            consent_analytical: consentAnalytical,
            consent_advertising: consentAdvertising
          });
        },
        saveConsentChoices,
        applyConsentChoices,
        cookieTypes: [
          {
            id: 'necessary',
            name: 'Necessary',
            description: '<p>Required for website functionality.</p>',
            required: true,
            onAccept: () => {
              console.debug('Necessary cookies diaktifkan');
            }
          },
          {
            id: 'analytical',
            name: 'Analytical',
            description: '<p>Helps analyze website usage.</p>',
            required: false,
            onAccept: () => {
              updateConsentMode({ analytical: true });
              console.debug('Analytical cookies diaktifkan');
            },
            onReject: () => {
              updateConsentMode({ analytical: false });
              console.debug('Analytical cookies ditolak');
            }
          },
          {
            id: 'advertising',
            name: 'Advertising',
            description: '<p>Used for personalized ads.</p>',
            required: false,
            onAccept: () => {
              updateConsentMode({ advertising: true });
              console.debug('Advertising cookies diaktifkan');
            },
            onReject: () => {
              updateConsentMode({ advertising: false });
              console.debug('Advertising cookies ditolak');
            }
          }
        ],
		  text: {
			banner: {
			  title: "Your privacy matters to us.",
			  description: "<p>We process your personal information to measure and improve our site and services, to assist with our marketing campaigns, and to provide personalized content and advertising. For more information, see our <a href='/p/privacy-policy.html' target='_blank'>Privacy Policy</a>.</p>",
			  acceptAllButtonText: "Accept all",
			  rejectNonEssentialButtonText: "Reject non-essential"
			},
			preferences: {
			  title: "Manage Consent Preferences",
			  description: "<p>We respect your right to privacy. You have control over how we improve and personalize your experience. Therefore, you can choose not to allow some types of cookies. Your cookie preferences will apply across our website.</p>"
			}
		  },
        position: {
          banner: 'bottomLeft'
        },
        background: {
          showBackground: true
        }
      });
      console.debug('Allbestview Cookie Banner diinisialisasi');
    } else {
      setTimeout(waitForConsentManagerAndGtag, 50);
    }
  })();
})();