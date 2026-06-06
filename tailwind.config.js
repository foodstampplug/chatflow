/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	safelist: [
		// Dynamic platform color classes used with inline styles / computed values
		'bg-[#9146FF]', 'bg-[#FF0000]', 'bg-[#53FC18]', 'bg-[#000000]',
		'text-[#9146FF]', 'text-[#FF0000]', 'text-[#53FC18]',
		'border-[#9146FF]', 'border-[#FF0000]', 'border-[#53FC18]',
		'border-[#9146FF]/30', 'border-[#FF0000]/30', 'border-[#53FC18]/30',
		'bg-[#9146FF]/10', 'bg-[#FF0000]/10', 'bg-[#53FC18]/10',
		'bg-[#9146FF]/20', 'bg-[#FF0000]/20', 'bg-[#53FC18]/20',
		'focus:border-[#9146FF]', 'focus:border-[#FF0000]', 'focus:border-[#53FC18]',
		'focus:ring-[#9146FF]', 'focus:ring-[#53FC18]',
		'text-[#9146FF]', 'text-[#FF0000]', 'text-[#53FC18]',
		'bg-twitch', 'bg-youtube', 'bg-kick', 'bg-xtwitter',
		'hover:bg-[#6B2ECC]', 'hover:bg-[#CC0000]', 'hover:bg-[#3BC410]'
	],
	theme: {
		extend: {
			colors: {
				twitch: '#9146FF',
				youtube: '#FF0000',
				kick: '#53FC18',
				xtwitter: '#000000',
				'twitch-dark': '#6B2ECC',
				'youtube-dark': '#CC0000',
				'kick-dark': '#3BC410',
				'xtwitter-dark': '#1a1a1a'
			},
			fontFamily: {
				sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
				display: ['"Space Grotesk"', 'system-ui', 'sans-serif']
			},
			animation: {
				'slide-in': 'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				'slide-in-right': 'slideInRight 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
				'fade-out': 'fadeOut 0.5s ease-out forwards',
				'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
				'pulse-live': 'pulseLive 1.8s ease-in-out infinite',
				'msg-enter': 'msgEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
			},
			keyframes: {
				slideIn: {
					'0%': { transform: 'translateX(120%)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				slideInRight: {
					'0%': { transform: 'translateX(110%) scale(0.95)', opacity: '0' },
					'60%': { transform: 'translateX(-4%) scale(1.01)', opacity: '1' },
					'100%': { transform: 'translateX(0) scale(1)', opacity: '1' }
				},
				fadeOut: {
					'0%': { opacity: '1' },
					'100%': { opacity: '0', transform: 'scale(0.95)' }
				},
				pulseSoft: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.5' }
				},
				pulseLive: {
					'0%, 100%': { opacity: '1', transform: 'scale(1)' },
					'50%': { opacity: '0.6', transform: 'scale(0.85)' }
				},
				msgEnter: {
					'0%': { transform: 'translateY(8px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				}
			},
			backgroundImage: {
				'platform-gradient': 'linear-gradient(90deg, #9146FF, #53FC18, #FF0000, #000000)',
				'cf-gradient': 'linear-gradient(135deg, #9146FF 0%, #53FC18 100%)'
			}
		}
	},
	plugins: []
};
