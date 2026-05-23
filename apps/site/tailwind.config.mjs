/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          normal: 'var(--semantic-primary-normal)',
          strong: 'var(--semantic-primary-strong)',
          heavy: 'var(--semantic-primary-heavy)',
        },
        label: {
          normal: 'var(--semantic-label-normal)',
          strong: 'var(--semantic-label-strong)',
          neutral: 'var(--semantic-label-neutral)',
          alternative: 'var(--semantic-label-alternative)',
          assistive: 'var(--semantic-label-assistive)',
          disable: 'var(--semantic-label-disable)',
        },
        background: {
          'normal-normal': 'var(--semantic-background-normal-normal)',
          'normal-alternative': 'var(--semantic-background-normal-alternative)',
          'elevated-normal': 'var(--semantic-background-elevated-normal)',
        },
        interaction: {
          inactive: 'var(--semantic-interaction-inactive)',
          disable: 'var(--semantic-interaction-disable)',
        },
        line: {
          'normal-normal': 'var(--semantic-line-normal-normal)',
          'solid-normal': 'var(--semantic-line-solid-normal)',
        },
        status: {
          positive: 'var(--semantic-status-positive)',
          cautionary: 'var(--semantic-status-cautionary)',
          negative: 'var(--semantic-status-negative)',
        },
        fill: {
          normal: 'var(--semantic-fill-normal)',
          strong: 'var(--semantic-fill-strong)',
        },
        material: {
          dimmer: 'var(--semantic-material-dimmer)',
        },
        inverse: {
          primary: 'var(--semantic-inverse-primary)',
          background: 'var(--semantic-inverse-background)',
        },
      },
      boxShadow: {
        'normal-xsmall': 'var(--elevation-shadow-normal-xsmall)',
        'normal-small': 'var(--elevation-shadow-normal-small)',
        'normal-medium': 'var(--elevation-shadow-normal-medium)',
        'normal-large': 'var(--elevation-shadow-normal-large)',
        'normal-xlarge': 'var(--elevation-shadow-normal-xlarge)',
        'spread-small': 'var(--elevation-shadow-spread-small)',
        'spread-medium': 'var(--elevation-shadow-spread-medium)',
      },
      fontFamily: {
        sans: ['var(--font-family)'],
      },
      fontSize: {
        display1: ['var(--font-display1-size)', { lineHeight: 'var(--font-display1-lh)', letterSpacing: 'var(--font-display1-ls)', fontWeight: 'var(--font-display1-weight)' }],
        display2: ['var(--font-display2-size)', { lineHeight: 'var(--font-display2-lh)', letterSpacing: 'var(--font-display2-ls)', fontWeight: 'var(--font-display2-weight)' }],
        title1:   ['var(--font-title1-size)',   { lineHeight: 'var(--font-title1-lh)',   letterSpacing: 'var(--font-title1-ls)',   fontWeight: 'var(--font-title1-weight)' }],
        title2:   ['var(--font-title2-size)',   { lineHeight: 'var(--font-title2-lh)',   letterSpacing: 'var(--font-title2-ls)',   fontWeight: 'var(--font-title2-weight)' }],
        title3:   ['var(--font-title3-size)',   { lineHeight: 'var(--font-title3-lh)',   letterSpacing: 'var(--font-title3-ls)',   fontWeight: 'var(--font-title3-weight)' }],
        heading1: ['var(--font-heading1-size)', { lineHeight: 'var(--font-heading1-lh)', letterSpacing: 'var(--font-heading1-ls)', fontWeight: 'var(--font-heading1-weight)' }],
        heading2: ['var(--font-heading2-size)', { lineHeight: 'var(--font-heading2-lh)', letterSpacing: 'var(--font-heading2-ls)', fontWeight: 'var(--font-heading2-weight)' }],
        headline1:['var(--font-headline1-size)',{ lineHeight: 'var(--font-headline1-lh)',letterSpacing: 'var(--font-headline1-ls)',fontWeight: 'var(--font-headline1-weight)' }],
        headline2:['var(--font-headline2-size)',{ lineHeight: 'var(--font-headline2-lh)',letterSpacing: 'var(--font-headline2-ls)',fontWeight: 'var(--font-headline2-weight)' }],
        body1:    ['var(--font-body1-size)',    { lineHeight: 'var(--font-body1-lh)',    letterSpacing: 'var(--font-body1-ls)',    fontWeight: 'var(--font-body1-weight)' }],
        body2:    ['var(--font-body2-size)',    { lineHeight: 'var(--font-body2-lh)',    letterSpacing: 'var(--font-body2-ls)',    fontWeight: 'var(--font-body2-weight)' }],
        label1:   ['var(--font-label1-size)',   { lineHeight: 'var(--font-label1-lh)',   letterSpacing: 'var(--font-label1-ls)',   fontWeight: 'var(--font-label1-weight)' }],
        label2:   ['var(--font-label2-size)',   { lineHeight: 'var(--font-label2-lh)',   letterSpacing: 'var(--font-label2-ls)',   fontWeight: 'var(--font-label2-weight)' }],
        caption1: ['var(--font-caption1-size)', { lineHeight: 'var(--font-caption1-lh)', letterSpacing: 'var(--font-caption1-ls)', fontWeight: 'var(--font-caption1-weight)' }],
        caption2: ['var(--font-caption2-size)', { lineHeight: 'var(--font-caption2-lh)', letterSpacing: 'var(--font-caption2-ls)', fontWeight: 'var(--font-caption2-weight)' }],
      },
    },
  },
  plugins: [],
}
