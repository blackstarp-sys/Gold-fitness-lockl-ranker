import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: { translation: { Dashboard: 'Dashboard', Reviews: 'Reviews', Posts: 'Post Scheduler', Analytics: 'Analytics', TotalReviews: 'Total Reviews', AvgRating: 'Avg Rating', PendingReplies: 'Pending Replies', SearchViews: 'Search Views' } },
  hi: { translation: { Dashboard: 'डैशबोर्ड', Reviews: 'समीक्षा', Posts: 'पोस्ट शेड्यूलर', Analytics: 'एनालिटिक्स', TotalReviews: 'कुल समीक्षा', AvgRating: 'औसत रेटिंग', PendingReplies: 'लंबित उत्तर', SearchViews: 'खोज दृश्य' } },
  bn: { translation: { Dashboard: 'ড্যাশবোর্ড', Reviews: 'পর্যালোচনা' } },
  mr: { translation: { Dashboard: 'डॅशबोर्ड', Reviews: 'पुनरावलोकने' } },
  gu: { translation: { Dashboard: 'ડેશબોર્ડ', Reviews: 'સમીક્ષાઓ' } },
  ta: { translation: { Dashboard: 'முகப்பு', Reviews: 'மதிப்புரைகள்' } },
  te: { translation: { Dashboard: 'డాష్‌బోర్డ్', Reviews: 'సమీక్షలు' } },
  kn: { translation: { Dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', Reviews: 'ವಿಮರ್ಶೆಗಳು' } },
  ml: { translation: { Dashboard: 'ഡാഷ്ബോർഡ്', Reviews: 'അവലോകനങ്ങൾ' } },
  pa: { translation: { Dashboard: 'ਡੈਸ਼ਬੋਰਡ', Reviews: 'ਸਮੀਖਿਆਵਾਂ' } },
  as: { translation: { Dashboard: 'ডেচবৰ্ড', Reviews: 'পৰ্যালোচনা' } },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
