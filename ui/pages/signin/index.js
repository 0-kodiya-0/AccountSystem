import BodyCenter from '@/components/BodyCenter'
import SignInAndUpBody from '@/components/SignInAndUpBody'
import server from '@/help/auth/server';
import Error from 'next/error';

export async function getServerSideProps(context) {
  const props = { error: false  };
  try {
    await server.serverLogin();
  } catch (error) {
    props.error = "500"
  };
  return {
    props: props
  };
}

export default function Signin(props) {
  if (props.error === false) {
    return (
      <BodyCenter>
        <SignInAndUpBody>
          <form className='w-full h-full flex justify-center flex-col items-center'>
            <p className="mt-2 text-3xl font-medium text-gray-900 mb-8">Sign In</p>
            <div className="mb-8 w-10/12">
              <label htmlFor="input-group-1" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Username</label>
              <div className="relative">
                <input type="text" id="input-group-1" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pr-10 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none">
                  <img className='w-5 h-5' src='/help-circle.svg' />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[#999999]">Username required</p>
            </div>
            <div className="mb-7 w-10/12">
              <label htmlFor="input-group-2" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Password</label>
              <div className="relative">
                <input type="text" id="input-group-2" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pr-10 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none">
                  <img className='w-5 h-5' src='/help-circle.svg' />
                </div>
              </div>
              <div className='w-full flex justify-between items-center'>
                <p className="mt-2 text-[11px] text-[#999999]">Password required</p>
                <p className="mt-2 text-[11px] text-[#999999]">Forgot password ?</p>
              </div>
            </div>
            <div className='w-10/12 flex justify-between items-center'>
              <button type="submit" className="text-white right-2.5 bottom-2.5 bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">Sign in</button>
              <p className="mt-2 text-[11px] text-[#999999]">Don't have an account</p>
            </div>
          </form>
        </SignInAndUpBody>
      </BodyCenter>
    )
  } else {
    return (
      <Error statusCode={props.error} />
    )
  };
};