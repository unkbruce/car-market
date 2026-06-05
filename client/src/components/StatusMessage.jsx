function StatusMessage({ title, message, action }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">{message}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export default StatusMessage;
