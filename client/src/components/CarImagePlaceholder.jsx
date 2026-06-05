const PLACEHOLDER_IMAGE = '/images/car-placeholder.png';

function CarImagePlaceholder({ large = false }) {
  return (
    <div className={`relative overflow-hidden bg-slate-100 ${large ? 'h-[420px] rounded-lg' : 'h-[108px] rounded-t-xl lg:h-[114px]'}`}>
      <img
        src={PLACEHOLDER_IMAGE}
        alt="차량 placeholder"
        className="h-full w-full object-cover object-center"
      />
    </div>
  );
}

export default CarImagePlaceholder;
export { PLACEHOLDER_IMAGE };
