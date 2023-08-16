import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function BodyCenter({ children }) {
  return (
    <div className={`flex justify-center items-center w-screen h-screen flex-col ${inter.className}`}>
        {children}
    </div>
  )
}