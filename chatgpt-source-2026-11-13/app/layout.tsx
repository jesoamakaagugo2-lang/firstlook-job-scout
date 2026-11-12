import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'Firstlook | Jesoamaka’s Job Scout',description:'A private early-opportunity desk for support, success and onboarding roles.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
