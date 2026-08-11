import React, { useState } from 'react'

export function NavBar() {
  const [activeNav, setActiveNav] = useState('VĂN BẢN ĐẾN HẠN')
  const navItems = ['TRANG CHỦ', 'VĂN BẢN ĐẾN HẠN', 'TÌM KIẾM']

  const handleNavClick = (item) => {
    if (item === 'TRANG CHỦ') {
      window.location.href = '/'
      return
    }
    if (item === 'TÌM KIẾM') {
      window.location.href = '/?tab=search'
      return
    }
    setActiveNav(item)
  }

  return (
    <nav className="bg-[#2c6e49] w-full shadow-md">
      <div className="max-w-6xl mx-auto flex items-center">
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => handleNavClick(item)}
            className={`
              px-6 py-3 text-xs font-bold tracking-wide transition-all uppercase
              ${
                activeNav === item
                  ? 'bg-[#1a4a30] text-white shadow-inner'
                  : 'text-white hover:bg-[#1a4a30]/50'
              }
            `}
          >
            {item}
          </button>
        ))}
      </div>
    </nav>
  )
}
