'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=overflow;previous?.focus()}},[]);
  return <dialog ref={ref} className="modal gallery-modal" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X/></button></div>{children}</dialog>;
}
