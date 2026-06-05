/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
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
			animation: {
				'slide-in': 'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				'fade-out': 'fadeOut 0.5s ease-out forwards',
				'pulse-soft': 'pulseSoft 2s ease-in-out infinite'
			},
			keyframes: {
				slideIn: {
					'0%': { transform: 'translateX(120%)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				fadeOut: {
					'0%': { opacity: '1' },
					'100%': { opacity: '0', transform: 'scale(0.95)' }
				},
				pulseSoft: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.5' }
				}
			},
			fontFamily: {
				display: ['"Inter"', 'system-ui', 'sans-serif']
			}
		}
	},
	plugins: []
};
