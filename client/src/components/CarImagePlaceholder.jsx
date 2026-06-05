const PLACEHOLDER_IMAGE = '/images/car-placeholder.png';

function CarImagePlaceholder({ large = false }) {
  return (
    <div className={`relative overflow-hidden bg-slate-50 ${large ? 'h-[420px] rounded-lg' : 'h-[108px] rounded-t-xl lg:h-[114px]'}`}>
      <img
        src={PLACEHOLDER_IMAGE}
        alt="차량 placeholder"
        className="mx-auto h-full w-[90%] object-contain object-center"
      />
    </div>
  );
}

export default CarImagePlaceholder;
export { PLACEHOLDER_IMAGE };
