import createOrUpdateSubuser from '@/api/server/users/createOrUpdateSubuser';
import Button from '@/components/elements/Button';
import Can from '@/components/elements/Can';
import CheckBox from '@/components/elements/Checkbox';
import Field from '@/components/elements/Field';
import FlashMessageRender from '@/components/FlashMessageRender';
import PermissionRow from '@/components/server/users/PermissionRow';
import PermissionTitleBox from '@/components/server/users/PermissionTitleBox';
import ModalContext from '@/context/ModalContext';
import asModal from '@/hoc/asModal';
import { useDeepCompareMemo } from '@/plugins/useDeepCompareMemo';
import { usePermissions } from '@/plugins/usePermissions';
import { ApplicationStore } from '@/state';
import { ServerContext } from '@/state/server';
import { Subuser } from '@/state/server/subusers';
import { Actions, useStoreActions, useStoreState } from 'easy-peasy';
import { Form, Formik } from 'formik';
import React, { useContext, useEffect, useRef } from 'react';
import tw from 'twin.macro';
import { array, object, string } from 'yup';

type Props = {
    subuser?: Subuser;
};

interface Values {
    email: string;
    permissions: string[];
}

const EditSubuserModal = ({ subuser }: Props) => {
    const ref = useRef<HTMLHeadingElement>(null);
    const uuid = ServerContext.useStoreState(state => state.server.data!.uuid);
    const appendSubuser = ServerContext.useStoreActions(actions => actions.subusers.appendSubuser);
    const { clearFlashes, clearAndAddHttpError } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);
    const { dismiss, setPropOverrides } = useContext(ModalContext);

    const isRootAdmin = useStoreState(state => state.user.data!.rootAdmin);
    const permissions = useStoreState(state => state.permissions.data);
    // The currently logged in user's permissions. We're going to filter out any permissions
    // that they should not need.
    const loggedInPermissions = ServerContext.useStoreState(state => state.server.permissions);
    const [ canEditUser ] = usePermissions(subuser ? [ 'user.update' ] : [ 'user.create' ]);

    // The permissions that can be modified by this user.
    const editablePermissions = useDeepCompareMemo(() => {
        const cleaned = Object.keys(permissions)
            .map(key => Object.keys(permissions[key].keys).map(pkey => `${key}.${pkey}`));

        const list: string[] = ([] as string[]).concat.apply([], Object.values(cleaned));

        if (isRootAdmin || (loggedInPermissions.length === 1 && loggedInPermissions[0] === '*')) {
            return list;
        }

        return list.filter(key => loggedInPermissions.indexOf(key) >= 0);
    }, [ isRootAdmin, permissions, loggedInPermissions ]);

    const submit = (values: Values) => {
        setPropOverrides({ showSpinnerOverlay: true });
        clearFlashes('user:edit');

        createOrUpdateSubuser(uuid, values, subuser)
            .then(subuser => {
                appendSubuser(subuser);
                dismiss();
            })
            .catch(error => {
                console.error(error);
                setPropOverrides(null);
                clearAndAddHttpError({ key: 'user:edit', error });

                if (ref.current) {
                    ref.current.scrollIntoView();
                }
            });
    };

    useEffect(() => () => {
        clearFlashes('user:edit');
    }, []);

    return (
        <Formik
            onSubmit={submit}
            initialValues={{
                email: subuser?.email || '',
                permissions: subuser?.permissions || [],
            } as Values}
            validationSchema={object().shape({
                email: string()
                    .max(191, 'Email addresses must not exceed 191 characters.')
                    .email('A valid email address must be provided.')
                    .required('A valid email address must be provided.'),
                permissions: array().of(string()),
            })}
        >
            <Form>
                <div css={tw`flex justify-between`}>
                    <h2 css={tw`text-2xl`} ref={ref}>
                        {subuser ? `${canEditUser ? 'Modify' : 'View'} permissions for ${subuser.email}` : 'Create new subuser'}
                    </h2>
                    <div>
                        <Button type={'submit'} css={tw`w-full sm:w-auto`}>
                            {subuser ? 'Save' : 'Invite User'}
                        </Button>
                    </div>
                </div>
                <FlashMessageRender byKey={'user:edit'} css={tw`mt-4`} />
                {(!isRootAdmin && loggedInPermissions[0] !== '*') &&
                    <div css={tw`mt-4 pl-4 py-2 border-l-4 border-cyan-400`}>
                        <p css={tw`text-sm text-neutral-300`}>
                            Only permissions which your account is currently assigned may be selected when creating or
                            modifying other users.
                        </p>
                    </div>
                }
                {!subuser &&
                <>
                    <div css={tw`mt-6`}>
                        <Field
                            name={'email'}
                            label={'User Email'}
                            description={'Enter the email address of the user you wish to invite as a subuser for this server.'}
                        />
                    </div>
                    <div css={tw`bg-neutral-900 mt-4 p-3 rounded-t`}>
                        <div css={tw`flex items-center`}>
                            <p css={tw`text-sm uppercase flex-1`}>Select All</p>
                            <CheckBox
                                id={`permission_${permissions}`}
                                name={'permissions'}
                                css={tw`w-5 h-5`}
                                value={''}
                            >
                            </CheckBox>
                        </div>
                    </div>
                </>
                }
                <div css={tw`my-6`}>
                    {Object.keys(permissions).filter(key => key !== 'websocket').map((key, index) => (
                        <PermissionTitleBox
                            key={`permission_${key}`}
                            title={key}
                            isEditable={canEditUser}
                            permissions={Object.keys(permissions[key].keys).map(pkey => `${key}.${pkey}`)}
                            css={index > 0 ? tw`mt-4` : undefined}
                        >
                            <p css={tw`text-sm text-neutral-400 mb-4`}>
                                {permissions[key].description}
                            </p>
                            {Object.keys(permissions[key].keys).map(pkey => (
                                <PermissionRow
                                    key={`permission_${key}.${pkey}`}
                                    permission={`${key}.${pkey}`}
                                    disabled={!canEditUser || editablePermissions.indexOf(`${key}.${pkey}`) < 0}
                                />
                            ))}
                        </PermissionTitleBox>
                    ))}
                </div>
                <Can action={subuser ? 'user.update' : 'user.create'}>
                    <div css={tw`pb-6 flex justify-end`}>
                        <Button type={'submit'} css={tw`w-full sm:w-auto`}>
                            {subuser ? 'Save' : 'Invite User'}
                        </Button>
                    </div>
                </Can>
            </Form>
        </Formik>
    );
};

export default asModal<Props>({
    top: false,
})(EditSubuserModal);
