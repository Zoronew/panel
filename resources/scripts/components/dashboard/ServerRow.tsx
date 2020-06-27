import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer } from '@fortawesome/free-solid-svg-icons/faServer';
import { faEthernet } from '@fortawesome/free-solid-svg-icons/faEthernet';
import { faMicrochip } from '@fortawesome/free-solid-svg-icons/faMicrochip';
import { faMemory } from '@fortawesome/free-solid-svg-icons/faMemory';
import { faHdd } from '@fortawesome/free-solid-svg-icons/faHdd';
import { Link } from 'react-router-dom';
import { Server } from '@/api/server/getServer';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import getServerResourceUsage, { ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToHuman } from '@/helpers';
import classNames from 'classnames';

// Determines if the current value is in an alarm threshold so we can show it in red rather
// than the more faded default style.
const isAlarmState = (current: number, limit: number): boolean => {
    const limitInBytes = limit * 1000 * 1000;

    return current / limitInBytes >= 0.90;
};

export default ({ server, className }: { server: Server; className: string | undefined }) => {
    const interval = useRef<number>(null);
    const [ stats, setStats ] = useState<ServerStats | null>(null);
    const [ statsError, setStatsError ] = useState(false);

    const getStats = () => {
        setStatsError(false);
        return getServerResourceUsage(server.uuid)
            .then(data => setStats(data))
            .catch(error => {
                setStatsError(true);
                console.error(error);
            });
    };

    useEffect(() => {
        getStats().then(() => {
            // @ts-ignore
            interval.current = setInterval(() => getStats(), 20000);
        });

        return () => {
            interval.current && clearInterval(interval.current);
        };
    }, []);

    const alarms = { cpu: false, memory: false, disk: false };
    if (stats) {
        alarms.cpu = server.limits.cpu === 0 ? false : (stats.cpuUsagePercent >= (server.limits.cpu * 0.9));
        alarms.memory = isAlarmState(stats.memoryUsageInBytes, server.limits.memory);
        alarms.disk = server.limits.disk === 0 ? false : isAlarmState(stats.diskUsageInBytes, server.limits.disk);
    }
    const disklimit = server.limits.disk != 0 ? bytesToHuman(server.limits.disk * 1000 * 1000) : "Unlimited";
    const memorylimit = server.limits.memory != 0 ? bytesToHuman(server.limits.memory * 1000 * 1000) : "Unlimited";

    return (
        <Link to={`/server/${server.id}`} className={`flex-wrap md:flex-no-wrap grey-row-box cursor-pointer ${className}`}>
            <div className={'icon hidden lg:block'}>
                <FontAwesomeIcon icon={faServer}/>
            </div>
            <div className={'flex-1 md:ml-4'}>
                <p className={'text-lg'}>{server.name}</p>
            </div>
            <div className={'w-3/5 md:w-1/4 overflow-hidden'}>
                <div className={'flex md:ml-4 justify-end md:justify-start'}>
                    <FontAwesomeIcon icon={faEthernet} className={'text-neutral-500 hidden md:block'}/>
                    <p className={'text-sm text-neutral-400 ml-2'}>
                        {
                            server.allocations.filter(alloc => alloc.default).map(allocation => (
                                <span key={allocation.ip + allocation.port.toString()}>{allocation.alias || allocation.ip}:{allocation.port}</span>
                            ))
                        }
                    </p>
                </div>
            </div>
            <div className={'w-full md:w-1/3 mt-8 md:mt-0 flex items-baseline relative'}>
                {!stats ?
                    !statsError ?
                        <SpinnerOverlay size={'tiny'} visible={true} backgroundOpacity={0.25}/>
                        :
                        server.isInstalling ?
                            <div className={'flex-1 text-center'}>
                                <span className={'bg-neutral-500 rounded px-2 py-1 text-neutral-100 text-xs'}>
                                    Installing
                                </span>
                            </div>
                            :
                            <div className={'flex-1 text-center'}>
                                <span className={'bg-red-500 rounded px-2 py-1 text-red-100 text-xs'}>
                                    {server.isSuspended ? 'Suspended' : 'Connection Error'}
                                </span>
                            </div>
                    :
                    <React.Fragment>
                        <div className={'sm:flex-1 sm:flex md:ml-4 justify-center hidden'}>
                            <FontAwesomeIcon
                                icon={faMicrochip}
                                className={classNames({
                                    'text-neutral-500': !alarms.cpu,
                                    'text-red-400': alarms.cpu,
                                })}
                            />
                            <p
                                className={classNames('text-sm ml-2', {
                                    'text-neutral-400': !alarms.cpu,
                                    'text-white': alarms.cpu,
                                })}
                            >
                                {stats.cpuUsagePercent} %
                            </p>
                        </div>
                        <div className={'flex-1 ml-4 sm:mx-4'}>
                            <div className={'flex justify-center'}>
                                <FontAwesomeIcon
                                    icon={faMemory}
                                    className={classNames({
                                        'text-neutral-500': !alarms.memory,
                                        'text-red-400': alarms.memory,
                                    })}
                                />
                                <p
                                    className={classNames('text-sm ml-2', {
                                        'text-neutral-400': !alarms.memory,
                                        'text-white': alarms.memory,
                                    })}
                                >
                                    {bytesToHuman(stats.memoryUsageInBytes)}
                                </p>
                            </div>
                            <p className={'text-xs text-neutral-600 text-center mt-1'}>of {memorylimit}</p>
                        </div>
                        <div className={'flex-1'}>
                            <div className={'flex justify-center'}>
                                <FontAwesomeIcon
                                    icon={faHdd}
                                    className={classNames({
                                        'text-neutral-500': !alarms.disk,
                                        'text-red-400': alarms.disk,
                                    })}
                                />
                                <p
                                    className={classNames('text-sm ml-2', {
                                        'text-neutral-400': !alarms.disk,
                                        'text-white': alarms.disk,
                                    })}
                                >
                                    {bytesToHuman(stats.diskUsageInBytes)}
                                </p>
                            </div>
                            <p className={'text-xs text-neutral-600 text-center mt-1'}>of {disklimit}</p>
                        </div>
                    </React.Fragment>
                }
            </div>
        </Link>
    );
};
