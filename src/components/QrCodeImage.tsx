import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface QrCodeImageProps {
  qrType: 'whatsapp' | 'custom' | string;
  qrWhatsappPhone: string;
  qrCustomUrl: string;
  className?: string;
  interactive?: boolean;
}

export function formatQrDestination(
  qrType: 'whatsapp' | 'booking' | 'custom' | string,
  qrWhatsappPhone?: string,
  qrCustomUrl?: string
): { link: string; display: string } {
  if (qrType === 'booking') {
    const bookingUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}#booking` : 'https://solimedical.com/booking';
    return {
      link: bookingUrl,
      display: 'صفحة هبوط حجز المواعيد',
    };
  }

  if (qrType === 'whatsapp') {
    let clean = (qrWhatsappPhone || '01092847162').replace(/\D/g, '');
    if (clean.startsWith('00')) {
      clean = clean.slice(2);
    }
    if (clean.startsWith('0') && clean.length === 11) {
      clean = `2${clean}`;
    } else if (clean.startsWith('1') && clean.length === 10) {
      clean = `20${clean}`;
    }
    const phone = clean || '201092847162';
    return {
      link: `https://wa.me/${phone}`,
      display: `واتساب (${phone})`,
    };
  }

  let url = (qrCustomUrl || 'https://solimedical.com').trim();
  if (!url) url = 'https://solimedical.com';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return {
    link: url,
    display: url,
  };
}

export const QrCodeImage: React.FC<QrCodeImageProps> = ({
  qrType,
  qrWhatsappPhone,
  qrCustomUrl,
  className = 'w-full h-full',
  interactive = true,
}) => {
  const [svgStr, setSvgStr] = useState<string>('');
  const destination = formatQrDestination(qrType, qrWhatsappPhone, qrCustomUrl);

  useEffect(() => {
    let active = true;
    const generate = async () => {
      try {
        const result = await QRCode.toString(destination.link, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });

        if (active) {
          setSvgStr(result);
        }
      } catch (err) {
        console.error('QR generation failed in component:', err);
      }
    };
    generate();
    return () => {
      active = false;
    };
  }, [destination.link]);

  const content = svgStr ? (
    <div
      className={`${className} [&_svg]:w-full [&_svg]:h-full [&_svg]:block`}
      dangerouslySetInnerHTML={{ __html: svgStr }}
    />
  ) : (
    <svg
      viewBox="0 0 100 100"
      className={`${className} text-slate-900`}
      fill="currentColor"
    >
      <path d="M10 10h30v30h-30zM15 15v20h20v-20zM22 22h6v6h-6zM60 10h30v30h-30zM65 15v20h20v-20zM72 22h6v6h-6zM10 60h30v30h-30zM15 65v20h20v-20zM22 72h6v6h-6zM60 60h10v10h-10zM80 60h10v10h-10zM70 70h10v10h-10zM60 80h10v10h-10zM80 80h10v10h-10zM45 10h10v80h-10z" />
    </svg>
  );

  if (interactive) {
    return (
      <a
        href={destination.link}
        target="_blank"
        rel="noopener noreferrer"
        title={`اختبار رمز QR: انقر لفتح ${destination.display}`}
        className="block w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
      >
        {content}
      </a>
    );
  }

  return content;
};
