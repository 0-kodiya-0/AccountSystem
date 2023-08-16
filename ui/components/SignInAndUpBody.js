export default function SignInAndUpBody({ children }) {
    return (
        <div className={`w-[40%] h-[60%] flex justify-start items-center border-[#F2F2ED] border-2 border-solid`}>
            <div className={`w-[40%] h-full border-[#F2F2ED] border-r-2 border-solid flex justify-center items-center`}>
                <h1 className={`text-7xl`}>LOGO</h1>
            </div>
            <div className="w-[60%] h-full flex justify-between flex-col">
                {children}
                <p className="m-2 text-[11px] text-center text-[#999999]">We'll never share your data with anyone else.</p>
            </div>
        </div>
    )
}