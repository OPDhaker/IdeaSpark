import Image from "next/image";
import Link from "next/link";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/100 via-black/40 to-transparent pb-6">
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/fc-icons/logo.svg"
            alt="IdeaSpark logo"
            width={32}
            height={32}
            className="w-8 h-8 rounded-md"
          />
        </Link>

        <div className="hidden md:flex items-center gap-16 text-sm text-gray-300">
          <Link href="/" className="flex flex-col items-center leading-none hover:text-white transition-colors">
            <span>Home</span>
            <span className="text-[10px] text-gray-500 mt-0.5">ホーム</span>
          </Link>
          <Link href="/playbook" className="flex flex-col items-center leading-none hover:text-white transition-colors">
            <span>Playbook</span>
            <span className="text-[10px] text-gray-500 mt-0.5">プレイブック</span>
          </Link>
          <Link href="/tracks" className="flex flex-col items-center leading-none hover:text-white transition-colors">
            <span>Tracks</span>
            <span className="text-[10px] text-gray-500 mt-0.5">トラック</span>
          </Link>
        </div>

        <Link
          href="/api/auth/login"
          className="flex flex-col items-center leading-none bg-[#4a5c3a] text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-[#566b44] transition-colors"
        >
          <span>Log In</span>
          <span className="text-[9px] text-white/50 mt-0.5">ログイン</span>
        </Link>
      </nav>
    </header>
  );
}